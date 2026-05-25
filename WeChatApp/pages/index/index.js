// pages/index/index.js
const { request } = require('../../utils/request');

Page({
  data: {
    recommendCourses: []
  },

  onLoad() {
    this.loadCourses();
  },

  onShow() {
    this.loadCourses();
  },

  loadCourses() {
    request({
      url: '/api/courses',
      method: 'GET',
      showLoading: false
    }).then(res => {
      if (res.data && res.data.length > 0) {
        this.setData({ recommendCourses: res.data });
      }
    }).catch(() => {});
  },

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