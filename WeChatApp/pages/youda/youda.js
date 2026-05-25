// pages/youda/youda.js
const app = getApp();
const { request } = require('../../utils/request');

Page({
  data: {
    activeTab: 0,
    tabs: ['我的作品', '动态', '友藏'],
    posts: [],
    myOpenid: '',
    expandedComments: {},
    commentTexts: {},
    showPublish: false,
    publishTheme: '',
    publishContent: '',
    publishImages: [],
    followingOpenids: []
  },

  onLoad() {
    const openid = app.globalData.openid || '';
    this.setData({ myOpenid: openid });
    if (openid) {
      this.loadFollowing();
      this.loadPosts();
    }
  },

  onShow() {
    const openid = app.globalData.openid || '';
    if (openid !== this.data.myOpenid) {
      this.setData({ myOpenid: openid });
    }
    this.loadPosts();
    this.loadFollowing();
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    if (index === this.data.activeTab) return;
    this.setData({ activeTab: index });
    this.loadPosts();
  },

  loadFollowing() {
    const myOpenid = this.data.myOpenid;
    if (!myOpenid) return;
    request({
      url: '/api/following',
      method: 'GET',
      showLoading: false
    }).then(res => {
      this.setData({ followingOpenids: res.data || [] });
    }).catch(() => {});
  },

  loadPosts() {
    const { activeTab } = this.data;
    const myOpenid = this.data.myOpenid || app.globalData.openid;
    if (!myOpenid) return;

    let url = '/api/posts';
    if (activeTab === 0) {
      url = '/api/posts?tab=mine';
    } else if (activeTab === 2) {
      url = '/api/posts?tab=following';
    }

    request({
      url,
      method: 'GET',
      showLoading: false
    }).then(res => {
      const posts = (res.data || []).map(post => {
        const comments = post.comments || [];
        return {
          ...post,
          isLiked: post.isLiked || false,
          isCollected: post.isCollected || false,
          commentCount: comments.length,
          displayTime: formatTime(post.createdAt)
        };
      });
      this.setData({ posts });
    }).catch(err => {
      console.error('加载帖子失败', err);
    });
  },

  // ── Publish ──

  showPublishForm() {
    this.setData({
      showPublish: true,
      publishTheme: '',
      publishContent: '',
      publishImages: []
    });
  },

  hidePublishForm() {
    this.setData({ showPublish: false });
  },

  onThemeInput(e) {
    this.setData({ publishTheme: e.detail.value });
  },

  onContentInput(e) {
    this.setData({ publishContent: e.detail.value });
  },

  chooseImages() {
    const remain = 9 - (this.data.publishImages || []).length;
    if (remain <= 0) {
      wx.showToast({ title: '最多选择9张图片', icon: 'none' });
      return;
    }
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = [...this.data.publishImages, ...res.tempFilePaths];
        this.setData({ publishImages: newImages });
      }
    });
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.publishImages.filter((_, i) => i !== index);
    this.setData({ publishImages: images });
  },

  submitPost() {
    const { publishTheme, publishContent, publishImages } = this.data;
    if (!publishContent.trim()) {
      wx.showToast({ title: '内容不能为空', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '发布中...' });

    const doPost = (imageUrls) => {
      request({
        url: '/api/posts',
        method: 'POST',
        data: {
          type: publishImages.length > 0 ? 'image' : 'text',
          theme: publishTheme,
          content: publishContent,
          images: imageUrls || []
        }
      }).then(() => {
        wx.hideLoading();
        wx.showToast({ title: '发布成功', icon: 'success' });
        this.hidePublishForm();
        this.loadPosts();
      }).catch(() => {
        wx.hideLoading();
      });
    };

    if (publishImages.length === 0) {
      return doPost([]);
    }

    // Upload images first
    const token = app.globalData.token;
    const BASE_URL = require('../../config/env').BASE_URL;
    let uploaded = 0;
    const urls = [];

    const uploadNext = (i) => {
      wx.uploadFile({
        url: `${BASE_URL}/api/upload/image`,
        filePath: publishImages[i],
        name: 'files',
        header: { 'Authorization': `Bearer ${token}` },
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.success && data.data && data.data.urls) {
              urls.push(...data.data.urls);
            }
          } catch (_) {}
          uploaded++;
          if (uploaded < publishImages.length) {
            uploadNext(uploaded);
          } else {
            wx.hideLoading();
            if (urls.length > 0) {
              doPost(urls);
            } else {
              wx.showToast({ title: '图片上传失败', icon: 'none' });
            }
          }
        },
        fail: () => {
          uploaded++;
          if (uploaded < publishImages.length) {
            uploadNext(uploaded);
          } else {
            wx.hideLoading();
            if (urls.length > 0) {
              doPost(urls);
            } else {
              wx.showToast({ title: '图片上传失败', icon: 'none' });
            }
          }
        }
      });
    };

    uploadNext(0);
  },

  previewImage(e) {
    const { urls, current } = e.currentTarget.dataset;
    wx.previewImage({ urls, current });
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

  // ── Comments ──

  toggleComments(e) {
    const postId = e.currentTarget.dataset.id;
    this.setData({
      [`expandedComments.${postId}`]: !this.data.expandedComments[postId]
    });
  },

  onCommentInput(e) {
    const postId = e.currentTarget.dataset.id;
    this.setData({ [`commentTexts.${postId}`]: e.detail.value });
  },

  submitComment(e) {
    const postId = e.currentTarget.dataset.id;
    const text = (this.data.commentTexts[postId] || '').trim();
    if (!text) {
      wx.showToast({ title: '评论不能为空', icon: 'none' });
      return;
    }

    request({
      url: `/api/posts/${postId}/comments`,
      method: 'POST',
      data: { text }
    }).then(() => {
      this.setData({ [`commentTexts.${postId}`]: '' });
      this.loadPosts();
    }).catch(() => {});
  },

  // ── Delete ──

  deletePost(e) {
    const postId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个作品吗？',
      success: (modalRes) => {
        if (modalRes.confirm) {
          request({
            url: `/api/posts/${postId}`,
            method: 'DELETE'
          }).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadPosts();
          }).catch(() => {});
        }
      }
    });
  },

  // ── Follow ──

  onShareAppMessage(e) {
    if (e.from === 'button' && e.target) {
      const id = e.target.dataset.id;
      const post = this.data.posts.find(p => p._id === id);
      if (post) {
        return {
          title: post.theme || post.content.slice(0, 30),
          path: `/pages/youda/youda`
        };
      }
    }
    return { title: '友答 - 编程学习社区', path: '/pages/youda/youda' };
  },

  followUser(e) {
    const { openid, name, avatar } = e.currentTarget.dataset;
    request({
      url: '/api/follow',
      method: 'POST',
      data: {
        followingOpenid: openid,
        followingName: name || '',
        followingAvatar: avatar || ''
      }
    }).then(() => {
      wx.showToast({ title: '已关注', icon: 'success' });
      this.loadFollowing();
    }).catch(() => {});
  }
});

function formatTime(dateStr) {
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
