// pages/profile/profile.js
const app = getApp();
const { request } = require('../../utils/request');
const { BASE_URL } = require('../../config/env');

Page({
  data: {
    userInfo: {
      nickname: '微信用户',
      avatar: '/images/avatar-default.png',
      points: 0,
      totalCheckins: 0,
      level: 1
    },
    levelName: '初学者',
    stats: {
      points: 0,
      learningTime: 0,
      completedCourses: 0
    },
    openid: ''
  },

  onLoad() {
    this.setData({ openid: app.globalData.openid });
    this.loadUserInfo();
    this.loadStats();
  },

  onShow() {
    this.loadUserInfo();
    this.loadStats();
  },

  loadUserInfo() {
    if (!this.data.openid) return;

    request({
      url: '/api/users/me',
      method: 'GET',
      showLoading: false
    }).then(res => {
      const user = res.data;
      const points = user.points || 0;
      const level = Math.floor(points / 100) + 1;
      this.setData({
        userInfo: {
          nickname: user.nickname || '微信用户',
          avatar: user.avatar || '/images/avatar-default.png',
          points: points,
          totalCheckins: user.totalCheckins || 0,
          level: level
        },
        levelName: this.getLevelName(level),
        'stats.points': points
      });
      app.globalData.userInfo = user;
    }).catch(() => {});
  },

  loadStats() {
    if (!this.data.openid) return;

    request({
      url: '/api/stats',
      method: 'GET',
      showLoading: false
    }).then(res => {
      this.setData({
        stats: {
          points: this.data.userInfo.points || 0,
          learningTime: res.data.learningTime || 0,
          completedCourses: res.data.completedCourses || 0
        }
      });
    }).catch(() => {});
  },

  getLevelName(level) {
    const names = ['初学者', '入门者', '进阶学习者', '高手', '专家', '大师'];
    return names[Math.min(level - 1, names.length - 1)] || '大师';
  },

  goToEditProfile() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile' });
  },

  goToRecords() {
    wx.navigateTo({ url: '/pages/my-records/my-records' });
  },

  goToYouDa(e) {
    const tab = e.currentTarget.dataset.tab || 0;
    app.globalData.youdaTab = parseInt(tab);
    wx.switchTab({ url: '/pages/youda/youda' });
  },

  goToHelp() {
    wx.showToast({ title: '帮助中心开发中', icon: 'none' });
  },

  goToFAQ() {
    wx.showToast({ title: '常见问题页面开发中', icon: 'none' });
  },

  goToShare() {
    wx.showToast({ title: '点击右上角菜单分享', icon: 'none' });
  },

  onShareAppMessage() {
    return {
      title: '友课 - 学习交友，共同进步',
      path: '/pages/index/index'
    };
  },

  goToAbout() {
    wx.showModal({
      title: '关于友课',
      content: '友课小程序 v1.0\n学习交友，共同进步',
      showCancel: false
    });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    wx.showLoading({ title: '上传中...' });

    wx.uploadFile({
      url: BASE_URL + '/api/upload/avatar',
      filePath: avatarUrl,
      name: 'file',
      header: {
        'Authorization': 'Bearer ' + app.globalData.token
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.success) {
            const avatarUrl = data.data.url;
            request({
              url: '/api/users/me',
              method: 'PUT',
              data: { avatar: avatarUrl },
              showLoading: false
            }).then(() => {
              wx.hideLoading();
              wx.showToast({ title: '头像更新成功', icon: 'success' });
              this.setData({ 'userInfo.avatar': avatarUrl });
              app.globalData.userInfo.avatar = avatarUrl;
            }).catch(() => { wx.hideLoading(); });
          } else {
            wx.hideLoading();
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' });
      }
    });
  }
});
