require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'youke_jwt_secret_2024';
const TOKEN_EXPIRES = '7d';
const WECHAT_APPID = process.env.WECHAT_APPID;
const WECHAT_SECRET = process.env.WECHAT_SECRET;

// ── MySQL ──
const dbConfig = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'youke',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
};
if (process.env.DB_SOCKET) {
  dbConfig.socketPath = process.env.DB_SOCKET;
} else {
  dbConfig.host = process.env.DB_HOST || 'localhost';
  dbConfig.port = parseInt(process.env.DB_PORT || '3306');
}
const pool = mysql.createPool(dbConfig);

// ── Middleware ──
app.use(cors());
app.use(bodyParser.json());

const publicDir = path.join(__dirname, 'public');
const avatarsDir = path.join(publicDir, 'avatars');
[publicDir, avatarsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
app.use(express.static(publicDir));

const storage = multer.diskStorage({
  destination: avatarsDir,
  filename: (req, file, cb) => {
    cb(null, `${req.openid}_${Date.now()}.png`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// JWT 验证中间件
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未登录' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.openid = decoded.openid;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }
}

// 可选认证（用于公开接口同时获取当前用户状态）
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
      req.openid = decoded.openid;
    } catch (_) {}
  }
  next();
}

// ── 工具函数 ──
function formatComments(rows) {
  return rows.map(c => ({
    openid: c.openid,
    nickname: c.nickname,
    avatar: c.avatar,
    text: c.text,
    createdAt: c.created_at
  }));
}

function hostUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

// ── 登录 ──
app.post('/api/login', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: '缺少 code 参数' });
  }
  try {
    const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: { appid: WECHAT_APPID, secret: WECHAT_SECRET, js_code: code, grant_type: 'authorization_code' }
    });
    const { openid, errmsg } = wxRes.data;
    if (!openid) {
      return res.status(400).json({ success: false, message: errmsg || '微信登录失败' });
    }

    // 查找或创建用户
    const [rows] = await pool.query('SELECT * FROM users WHERE openid = ?', [openid]);
    let user;
    if (rows.length === 0) {
      await pool.query(
        'INSERT INTO users (openid, nickname, avatar) VALUES (?, ?, ?)',
        [openid, '微信用户', '/images/avatar-default.png']
      );
      user = { openid, nickname: '微信用户', avatar: '/images/avatar-default.png', points: 0, totalCheckins: 0 };
    } else {
      user = rows[0];
    }

    const token = jwt.sign({ openid }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });

    res.json({
      success: true,
      data: {
        token,
        userInfo: {
          openid: user.openid,
          nickname: user.nickname,
          avatar: user.avatar,
          points: user.points || 0,
          totalCheckins: user.total_checkins || 0
        }
      }
    });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ── 用户 ──
app.get('/api/users/me', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE openid = ?', [req.openid]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    const u = rows[0];
    res.json({
      success: true,
      data: {
        openid: u.openid,
        nickname: u.nickname,
        avatar: u.avatar,
        points: u.points || 0,
        totalCheckins: u.total_checkins || 0,
        level: Math.floor((u.points || 0) / 100) + 1
      }
    });
  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

app.put('/api/users/me', auth, async (req, res) => {
  const { nickname, avatar } = req.body;
  try {
    const updates = [];
    const params = [];
    if (nickname !== undefined) { updates.push('nickname = ?'); params.push(nickname); }
    if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '无更新内容' });
    }
    params.push(req.openid);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE openid = ?`, params);
    res.json({ success: true, message: '保存成功' });
  } catch (err) {
    console.error('更新用户信息失败:', err);
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// ── 头像上传 ──
app.post('/api/upload/avatar', auth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '请选择图片' });
  }
  const url = `${hostUrl(req)}/avatars/${req.file.filename}`;
  res.json({ success: true, data: { url } });
});

// ── 帖子列表 ──
app.get('/api/posts', optionalAuth, async (req, res) => {
  const { tab } = req.query;
  const myOpenid = req.openid || '';
  try {
    let sql, params = [];
    if (tab === 'mine' && myOpenid) {
      sql = 'SELECT * FROM posts WHERE openid = ? ORDER BY created_at DESC';
      params = [myOpenid];
    } else if (tab === 'following' && myOpenid) {
      const [followRows] = await pool.query('SELECT following_openid FROM follows WHERE openid = ?', [myOpenid]);
      const followingIds = followRows.map(r => r.following_openid);
      if (followingIds.length > 0) {
        sql = `SELECT DISTINCT p.* FROM posts p
               LEFT JOIN post_collects pc ON pc.post_id = p.id AND pc.openid = ?
               WHERE p.openid IN (${followingIds.map(() => '?').join(',')}) OR pc.openid IS NOT NULL
               ORDER BY p.created_at DESC`;
        params = [myOpenid, ...followingIds];
      } else {
        sql = `SELECT p.* FROM posts p
               INNER JOIN post_collects pc ON pc.post_id = p.id AND pc.openid = ?
               ORDER BY p.created_at DESC`;
        params = [myOpenid];
      }
    } else {
      sql = 'SELECT * FROM posts ORDER BY created_at DESC';
    }

    const [postRows] = await pool.query(sql, params);
    const postIds = postRows.map(p => p.id);

    // 批量取评论
    let commentsMap = {};
    if (postIds.length > 0) {
      const placeholders = postIds.map(() => '?').join(',');
      const [commentRows] = await pool.query(
        `SELECT * FROM comments WHERE post_id IN (${placeholders}) ORDER BY created_at ASC`,
        postIds
      );
      commentRows.forEach(c => {
        if (!commentsMap[c.post_id]) commentsMap[c.post_id] = [];
        commentsMap[c.post_id].push({
          openid: c.openid,
          nickname: c.nickname,
          avatar: c.avatar,
          text: c.text,
          createdAt: c.created_at
        });
      });
    }

    // 批量取当前用户的点赞/收藏状态
    let likeSet = new Set();
    let collectSet = new Set();
    if (myOpenid && postIds.length > 0) {
      const ph = postIds.map(() => '?').join(',');
      const [likes] = await pool.query(
        `SELECT post_id FROM post_likes WHERE openid = ? AND post_id IN (${ph})`,
        [myOpenid, ...postIds]
      );
      likes.forEach(l => likeSet.add(l.post_id));
      const [collects] = await pool.query(
        `SELECT post_id FROM post_collects WHERE openid = ? AND post_id IN (${ph})`,
        [myOpenid, ...postIds]
      );
      collects.forEach(c => collectSet.add(c.post_id));
    }

    const posts = postRows.map(p => ({
      id: p.id,
      _id: String(p.id),
      _openid: p.openid,
      type: p.type,
      theme: p.theme,
      content: p.content,
      videoUrl: p.video_url,
      avatar: p.avatar,
      username: p.username,
      likes: p.likes || 0,
      isLiked: likeSet.has(p.id),
      isCollected: collectSet.has(p.id),
      commentCount: (commentsMap[p.id] || []).length,
      comments: commentsMap[p.id] || [],
      createdAt: p.created_at,
      displayTime: formatTime(p.created_at)
    }));

    res.json({ success: true, data: posts });
  } catch (err) {
    console.error('获取帖子失败:', err);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// ── 发布帖子 ──
app.post('/api/posts', auth, async (req, res) => {
  const { type, theme, content, videoUrl } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: '内容不能为空' });
  }
  try {
    // 获取用户信息
    const [users] = await pool.query('SELECT nickname, avatar FROM users WHERE openid = ?', [req.openid]);
    const nickname = users.length > 0 ? users[0].nickname : '微信用户';
    const avatar = users.length > 0 ? users[0].avatar : '/images/avatar-default.png';

    const [result] = await pool.query(
      `INSERT INTO posts (openid, type, theme, content, video_url, avatar, username, likes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [req.openid, type || 'text', (theme || '').trim(), content.trim(), videoUrl || '', avatar, nickname]
    );

    const [rows] = await pool.query('SELECT * FROM posts WHERE id = ?', [result.insertId]);
    const p = rows[0];
    res.json({
      success: true,
      data: {
        id: p.id,
        _id: String(p.id),
        _openid: p.openid,
        type: p.type,
        theme: p.theme,
        content: p.content,
        videoUrl: p.video_url,
        avatar: p.avatar,
        username: p.username,
        likes: 0,
        isLiked: false,
        isCollected: false,
        commentCount: 0,
        comments: [],
        createdAt: p.created_at,
        displayTime: formatTime(p.created_at)
      }
    });
  } catch (err) {
    console.error('发布帖子失败:', err);
    res.status(500).json({ success: false, message: '发布失败' });
  }
});

// ── 删除帖子 ──
app.delete('/api/posts/:id', auth, async (req, res) => {
  const postId = parseInt(req.params.id);
  try {
    const [rows] = await pool.query('SELECT openid FROM posts WHERE id = ?', [postId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '帖子不存在' });
    }
    if (rows[0].openid !== req.openid) {
      return res.status(403).json({ success: false, message: '只能删除自己的作品' });
    }
    // 删除关联数据
    await pool.query('DELETE FROM comments WHERE post_id = ?', [postId]);
    await pool.query('DELETE FROM post_likes WHERE post_id = ?', [postId]);
    await pool.query('DELETE FROM post_collects WHERE post_id = ?', [postId]);
    await pool.query('DELETE FROM posts WHERE id = ?', [postId]);
    res.json({ success: true });
  } catch (err) {
    console.error('删除帖子失败:', err);
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// ── 点赞/取消 ──
app.post('/api/posts/:id/like', auth, async (req, res) => {
  const postId = parseInt(req.params.id);
  try {
    const [exists] = await pool.query(
      'SELECT id FROM post_likes WHERE post_id = ? AND openid = ?',
      [postId, req.openid]
    );
    if (exists.length > 0) {
      // 取消点赞
      await pool.query('DELETE FROM post_likes WHERE post_id = ? AND openid = ?', [postId, req.openid]);
      await pool.query('UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = ?', [postId]);
      res.json({ success: true, data: { isLiked: false } });
    } else {
      // 点赞
      await pool.query('INSERT INTO post_likes (post_id, openid) VALUES (?, ?)', [postId, req.openid]);
      await pool.query('UPDATE posts SET likes = likes + 1 WHERE id = ?', [postId]);
      res.json({ success: true, data: { isLiked: true } });
    }
  } catch (err) {
    console.error('点赞操作失败:', err);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// ── 收藏/取消 ──
app.post('/api/posts/:id/collect', auth, async (req, res) => {
  const postId = parseInt(req.params.id);
  try {
    const [exists] = await pool.query(
      'SELECT id FROM post_collects WHERE post_id = ? AND openid = ?',
      [postId, req.openid]
    );
    if (exists.length > 0) {
      await pool.query('DELETE FROM post_collects WHERE post_id = ? AND openid = ?', [postId, req.openid]);
      res.json({ success: true, data: { isCollected: false } });
    } else {
      await pool.query('INSERT INTO post_collects (post_id, openid) VALUES (?, ?)', [postId, req.openid]);
      res.json({ success: true, data: { isCollected: true } });
    }
  } catch (err) {
    console.error('收藏操作失败:', err);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// ── 评论 ──
app.post('/api/posts/:id/comments', auth, async (req, res) => {
  const postId = parseInt(req.params.id);
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, message: '评论不能为空' });
  }
  try {
    const [users] = await pool.query('SELECT nickname, avatar FROM users WHERE openid = ?', [req.openid]);
    const nickname = users.length > 0 ? users[0].nickname : '微信用户';
    const avatar = users.length > 0 ? users[0].avatar : '/images/avatar-default.png';

    const [result] = await pool.query(
      'INSERT INTO comments (post_id, openid, nickname, avatar, text, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [postId, req.openid, nickname, avatar, text.trim()]
    );

    res.json({
      success: true,
      data: {
        id: result.insertId,
        openid: req.openid,
        nickname,
        avatar,
        text: text.trim(),
        createdAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('评论失败:', err);
    res.status(500).json({ success: false, message: '评论失败' });
  }
});

// ── 关注/取消 ──
app.post('/api/follow', auth, async (req, res) => {
  const { followingOpenid, followingName, followingAvatar } = req.body;
  if (!followingOpenid) {
    return res.status(400).json({ success: false, message: '缺少用户信息' });
  }
  if (followingOpenid === req.openid) {
    return res.status(400).json({ success: false, message: '不能关注自己' });
  }
  try {
    await pool.query(
      `INSERT INTO follows (openid, following_openid, following_name, following_avatar, created_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE following_name = VALUES(following_name), following_avatar = VALUES(following_avatar)`,
      [req.openid, followingOpenid, followingName || '', followingAvatar || '']
    );
    res.json({ success: true, data: { following: true } });
  } catch (err) {
    console.error('关注失败:', err);
    res.status(500).json({ success: false, message: '关注失败' });
  }
});

app.delete('/api/follow/:followingOpenid', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM follows WHERE openid = ? AND following_openid = ?',
      [req.openid, req.params.followingOpenid]
    );
    res.json({ success: true, data: { following: false } });
  } catch (err) {
    console.error('取消关注失败:', err);
    res.status(500).json({ success: false, message: '取消关注失败' });
  }
});

// ── 预约 ──
app.get('/api/bookings', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM bookings WHERE openid = ? ORDER BY created_at DESC',
      [req.openid]
    );
    const bookings = rows.map(b => ({
      _id: String(b.id),
      id: b.id,
      courseId: b.course_id,
      courseName: b.course_name,
      teacher: b.teacher,
      time: b.time,
      slotId: b.slot_id,
      status: b.status,
      pointsEarned: b.points_earned,
      createdAt: b.created_at
    }));
    res.json({ success: true, data: bookings });
  } catch (err) {
    console.error('获取预约失败:', err);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

app.post('/api/bookings', auth, async (req, res) => {
  const { courseId, courseName, teacher, time, slotId } = req.body;
  if (!courseId) {
    return res.status(400).json({ success: false, message: '缺少课程信息' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO bookings (openid, course_id, course_name, teacher, time, slot_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'booked', NOW())`,
      [req.openid, courseId, courseName || '', teacher || '', time || '', slotId || '']
    );
    res.json({
      success: true,
      data: {
        _id: String(result.insertId),
        id: result.insertId,
        courseId, courseName, teacher, time, slotId,
        status: 'booked',
        pointsEarned: 0,
        createdAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('创建预约失败:', err);
    res.status(500).json({ success: false, message: '预约失败' });
  }
});

app.put('/api/bookings/:id', auth, async (req, res) => {
  const bookingId = parseInt(req.params.id);
  const { status } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ? AND openid = ?', [bookingId, req.openid]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '预约不存在' });
    }
    await pool.query('UPDATE bookings SET status = ? WHERE id = ?', [status || 'cancelled', bookingId]);
    res.json({ success: true });
  } catch (err) {
    console.error('更新预约失败:', err);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// ── 签到 ──
app.post('/api/checkin', auth, async (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) {
    return res.status(400).json({ success: false, message: '缺少预约ID' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 验证预约
    const [bookings] = await conn.query(
      'SELECT * FROM bookings WHERE id = ? AND openid = ? AND status = ?',
      [parseInt(bookingId), req.openid, 'booked']
    );
    if (bookings.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, message: '预约不存在或已签到' });
    }

    // 计算积分（周末 +5）
    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const points = 10 + (isWeekend ? 5 : 0);

    // 更新预约状态
    await conn.query(
      'UPDATE bookings SET status = ?, points_earned = ? WHERE id = ?',
      ['checked_in', points, parseInt(bookingId)]
    );
    // 积分日志
    await conn.query(
      'INSERT INTO points_log (openid, type, points, description, created_at) VALUES (?, ?, ?, ?, NOW())',
      [req.openid, 'checkin', points, `课程签到${isWeekend ? '（周末加成）' : ''}`]
    );
    // 用户积分累加
    await conn.query(
      'UPDATE users SET points = points + ?, total_checkins = total_checkins + 1 WHERE openid = ?',
      [points, req.openid]
    );

    await conn.commit();
    conn.release();

    // 获取最新积分
    const [users] = await pool.query('SELECT points FROM users WHERE openid = ?', [req.openid]);

    res.json({
      success: true,
      data: {
        pointsEarned: points,
        totalPoints: users.length > 0 ? users[0].points : points
      }
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('签到失败:', err);
    res.status(500).json({ success: false, message: '签到失败' });
  }
});

// ── 关注列表（用于友藏tab过滤） ──
app.get('/api/following', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT following_openid FROM follows WHERE openid = ?',
      [req.openid]
    );
    res.json({
      success: true,
      data: rows.map(r => r.following_openid)
    });
  } catch (err) {
    console.error('获取关注列表失败:', err);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// ── 预约状态（用于首页） ──
app.get('/api/bookings/status', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT course_id, status FROM bookings WHERE openid = ? AND status IN (?, ?)',
      [req.openid, 'booked', 'checked_in']
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('获取预约状态失败:', err);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// ── 学习统计 ──
app.get('/api/stats', auth, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT points, total_checkins FROM users WHERE openid = ?', [req.openid]);
    const [bookings] = await pool.query(
      'SELECT COUNT(*) as count FROM bookings WHERE openid = ? AND status = ?',
      [req.openid, 'checked_in']
    );
    const completedCourses = bookings[0].count;
    const points = users.length > 0 ? users[0].points : 0;
    const totalCheckins = users.length > 0 ? users[0].total_checkins : 0;

    res.json({
      success: true,
      data: {
        points,
        totalCheckins,
        learningTime: completedCourses * 45, // 每次签到算45分钟
        completedCourses
      }
    });
  } catch (err) {
    console.error('获取统计失败:', err);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// ── 时间格式化 ──
function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

// ── 启动 ──
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
