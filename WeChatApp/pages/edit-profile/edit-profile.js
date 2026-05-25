// pages/edit-profile/edit-profile.js
const app = getApp();
const { request } = require('../../utils/request');
const { BASE_URL } = require('../../config/env');

Page({
  data: {
    openid: '',
    nickname: '',
    avatar: '',
    newAvatarPath: '',
    isAvatarChanged: false,
    saving: false
  },

  onLoad() {
    this.setData({ openid: app.globalData.openid });
    this.loadProfile();
  },

  loadProfile() {
    if (!this.data.openid) return;

    request({
      url: '/api/users/me',
      method: 'GET',
      showLoading: false
    }).then(res => {
      this.setData({
        nickname: res.data.nickname || '',
        avatar: res.data.avatar || ''
      });
    }).catch(() => {});
  },

  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    this.setData({
      newAvatarPath: avatarUrl,
      isAvatarChanged: true
    });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  saveProfile() {
    const { nickname, isAvatarChanged, newAvatarPath } = this.data;

    if (!nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    const doUpdate = (avatarUrl) => {
      const updateData = { nickname: nickname.trim() };
      if (avatarUrl) {
        updateData.avatar = avatarUrl;
      }

      request({
        url: '/api/users/me',
        method: 'PUT',
        data: updateData
      }).then(() => {
        wx.hideLoading();
        this.setData({ saving: false });
        wx.showToast({ title: '保存成功', icon: 'success' });
        app.globalData.userInfo = {
          ...app.globalData.userInfo,
          ...updateData
        };
        setTimeout(() => wx.navigateBack(), 1000);
      }).catch(() => {
        wx.hideLoading();
        this.setData({ saving: false });
      });
    };

    if (isAvatarChanged && newAvatarPath) {
      wx.uploadFile({
        url: BASE_URL + '/api/upload/avatar',
        filePath: newAvatarPath,
        name: 'file',
        header: {
          'Authorization': 'Bearer ' + app.globalData.token
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.success) {
              doUpdate(data.data.url);
            } else {
              wx.hideLoading();
              this.setData({ saving: false });
              wx.showToast({ title: '头像上传失败', icon: 'none' });
            }
          } catch (e) {
            wx.hideLoading();
            this.setData({ saving: false });
            wx.showToast({ title: '头像上传失败', icon: 'none' });
          }
        },
        fail: () => {
          wx.hideLoading();
          this.setData({ saving: false });
          wx.showToast({ title: '头像上传失败', icon: 'none' });
        }
      });
    } else {
      doUpdate(null);
    }
  }
});
