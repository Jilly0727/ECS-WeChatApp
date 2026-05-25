// pages/user-profile/user-profile.js
const app = getApp();
const { request } = require('../../utils/request');

Page({
  data: {
    user: {
      openid: '',
      nickname: '微信用户',
      avatar: '/images/avatar-default.png',
      points: 0,
      totalCheckins: 0,
      level: 1,
      followerCount: 0,
      followingCount: 0,
      postCount: 0,
      isFollowed: false
    },
    levelName: '初学者',
    posts: [],
    myOpenid: '',
    loading: true
  },

  onLoad(options) {
    const targetOpenid = options.openid || '';
    if (!targetOpenid) {
      wx.showToast({ title: '用户不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({
      myOpenid: app.globalData.openid || '',
      'user.openid': targetOpenid
    });
    this.loadUserProfile();
    this.loadUserPosts();
  },

  loadUserProfile() {
    const { openid } = this.data.user;
    if (!openid) return;

    request({
      url: `/api/users/${openid}`,
      method: 'GET',
      showLoading: false
    }).then(res => {
      const u = res.data;
      const level = Math.floor((u.points || 0) / 100) + 1;
      this.setData({
        user: {
          openid: u.openid,
          nickname: u.nickname || '微信用户',
          avatar: u.avatar || '/images/avatar-default.png',
          points: u.points || 0,
          totalCheckins: u.totalCheckins || 0,
          level: level,
          followerCount: u.followerCount || 0,
          followingCount: u.followingCount || 0,
          postCount: u.postCount || 0,
          isFollowed: u.isFollowed || false
        },
        levelName: this.getLevelName(level),
        loading: false
      });
    }).catch(() => {
      wx.showToast({ title: '用户不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    });
  },

  loadUserPosts() {
    const { openid } = this.data.user;
    if (!openid) return;

    request({
      url: `/api/users/${openid}/posts`,
      method: 'GET',
      showLoading: false
    }).then(res => {
      const posts = (res.data || []).map(post => ({
        ...post,
        isLiked: post.isLiked || false,
        isCollected: post.isCollected || false,
        commentCount: post.comments ? post.comments.length : 0,
        displayTime: this.formatTime(post.createdAt)
      }));
      this.setData({ posts });
    }).catch(() => {});
  },

  toggleFollow() {
    const { openid, isFollowed, nickname, avatar } = this.data.user;
    if (!openid) return;

    if (isFollowed) {
      request({
        url: `/api/follow/${openid}`,
        method: 'DELETE',
        showLoading: false
      }).then(() => {
        this.setData({ 'user.isFollowed': false, 'user.followerCount': this.data.user.followerCount - 1 });
        wx.showToast({ title: '已取消关注', icon: 'none' });
      }).catch(() => {});
    } else {
      request({
        url: '/api/follow',
        method: 'POST',
        data: {
          followingOpenid: openid,
          followingName: nickname,
          followingAvatar: avatar
        }
      }).then(() => {
        this.setData({ 'user.isFollowed': true, 'user.followerCount': this.data.user.followerCount + 1 });
        wx.showToast({ title: '已关注', icon: 'success' });
      }).catch(() => {});
    }
  },

  // ── Like / Collect ──

  toggleLike(e) {
    const postId = e.currentTarget.dataset.id;
    const index = this.data.posts.findIndex(p => p._id === postId);
    if (index === -1) return;

    const post = this.data.posts[index];
    const wasLiked = post.isLiked;

    this.setData({
      [`posts[${index}].isLiked`]: !wasLiked,
      [`posts[${index}].likes`]: wasLiked ? post.likes - 1 : post.likes + 1
    });

    request({
      url: `/api/posts/${postId}/like`,
      method: 'POST',
      showLoading: false
    }).catch(() => {
      this.setData({
        [`posts[${index}].isLiked`]: wasLiked,
        [`posts[${index}].likes`]: post.likes
      });
    });
  },

  toggleCollect(e) {
    const postId = e.currentTarget.dataset.id;
    const index = this.data.posts.findIndex(p => p._id === postId);
    if (index === -1) return;

    const post = this.data.posts[index];
    const wasCollected = post.isCollected;

    this.setData({ [`posts[${index}].isCollected`]: !wasCollected });

    request({
      url: `/api/posts/${postId}/collect`,
      method: 'POST',
      showLoading: false
    }).catch(() => {
      this.setData({ [`posts[${index}].isCollected`]: wasCollected });
    });
  },

  previewImage(e) {
    const { urls, current } = e.currentTarget.dataset;
    wx.previewImage({ urls, current });
  },

  getLevelName(level) {
    const names = ['初学者', '入门者', '进阶学习者', '高手', '专家', '大师'];
    return names[Math.min(level - 1, names.length - 1)] || '大师';
  },

  formatTime(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var now = new Date();
    var diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
});
