// pages/index/index.js
const app = getApp();
const { request } = require('../../utils/request');

Page({
  data: {
    userInfo: null,
    recommendCourses: [],
    showPublish: false,
    publishTheme: '',
    publishContent: '',
    publishImages: []
  },

  onLoad() {
    this.setData({ userInfo: app.globalData.userInfo });
    this.loadCourses();
  },

  onShow() {
    if (app.globalData.userInfo) {
      this.setData({ userInfo: app.globalData.userInfo });
    }
    this.loadCourses();
  },

  loadCourses() {
    request({
      url: '/api/courses/hot',
      method: 'GET',
      showLoading: false
    }).then(res => {
      if (res.data && res.data.length > 0) {
        this.setData({ recommendCourses: res.data });
      }
    }).catch(() => {});
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
      }).catch(() => {
        wx.hideLoading();
      });
    };

    if (publishImages.length === 0) {
      return doPost([]);
    }

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

  // ── Navigation ──

  goToCommunity() {
    wx.switchTab({ url: '/pages/youda/youda' });
  },

  goToRecords() {
    wx.navigateTo({ url: '/pages/my-records/my-records' });
  },

  goToBooking(e) {
    const id = e ? e.currentTarget.dataset.id : null;
    if (id) {
      wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${id}` });
    } else {
      wx.switchTab({ url: '/pages/booking/booking' });
    }
  },

  onShareAppMessage() {
    return {
      title: '友课 - 发现好课程，一起学习成长',
      path: '/pages/index/index'
    };
  }
});
