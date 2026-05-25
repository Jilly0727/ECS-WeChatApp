// pages/my-records/my-records.js
const app = getApp();
const { request } = require('../../utils/request');

Page({
  data: {
    myBookings: [],
    loading: true
  },

  onLoad() {
    this.fetchBookings();
  },

  onShow() {
    this.fetchBookings();
  },

  fetchBookings() {
    const openid = app.globalData.openid;
    if (!openid) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });

    request({
      url: '/api/bookings',
      method: 'GET',
      showLoading: false
    }).then(res => {
      this.setData({
        myBookings: res.data || [],
        loading: false
      });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  cancelBooking(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要取消这门课程的预约吗？',
      success: (res) => {
        if (res.confirm) {
          request({
            url: `/api/bookings/${id}`,
            method: 'PUT',
            data: { status: 'cancelled' }
          }).then(() => {
            wx.showToast({ title: '已取消', icon: 'success' });
            this.fetchBookings();
          }).catch(() => {});
        }
      }
    });
  },

  doCheckin(e) {
    const bookingId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '签到确认',
      content: '确认完成本次课程签到？',
      success: (res) => {
        if (res.confirm) {
          request({
            url: '/api/checkin',
            method: 'POST',
            data: { bookingId: bookingId }
          }).then(res => {
            const { pointsEarned } = res.data;
            wx.showModal({
              title: '签到成功',
              content: '获得 +' + pointsEarned + ' 积分！',
              showCancel: false,
              confirmText: '好的'
            });
            this.fetchBookings();
          }).catch(() => {});
        }
      }
    });
  }
});
