// pages/booking/booking.js
const app = getApp();
const { request } = require('../../utils/request');

Page({
  data: {
    tabs: [
      { key: 'upcoming', label: '近期课表' },
      { key: 'booked', label: '已预约课程' },
      { key: 'learned', label: '已学过课程' }
    ],
    currentTab: 'upcoming',
    upcomingCourses: [],
    bookedCourses: [],
    learnedCourses: [],
    loading: true
  },

  onLoad() {
    this.loadSchedule();
  },

  onShow() {
    this.loadSchedule();
  },

  loadSchedule() {
    const openid = app.globalData.openid;
    if (!openid) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });
    request({
      url: '/api/courses/schedule',
      method: 'GET',
      showLoading: false
    }).then(res => {
      if (res.data) {
        this.setData({
          upcomingCourses: res.data.upcoming || [],
          bookedCourses: res.data.booked || [],
          learnedCourses: res.data.learned || [],
          loading: false
        });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onTabChange(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ currentTab: key });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/course-detail/course-detail?id=${id}` });
  },

  bookCourse(e) {
    const id = e.currentTarget.dataset.id;
    const course = this.data.upcomingCourses.find(c => c.id === id);
    if (!course || course.isBooked) return;
    if (!course.available) {
      wx.showToast({ title: '该课程已满员', icon: 'none' });
      return;
    }

    request({
      url: '/api/bookings',
      method: 'POST',
      data: {
        courseId: course.id,
        courseName: course.name,
        teacher: course.teacher,
        time: course.time,
        slotId: course.slotId || ''
      }
    }).then(() => {
      wx.showToast({ title: '预约成功', icon: 'success' });
      this.loadSchedule();
    }).catch(() => {});
  },

  cancelBooking(e) {
    const bookingId = e.currentTarget.dataset.bookingId;
    wx.showModal({
      title: '提示',
      content: '确定要取消预约吗？',
      success: (res) => {
        if (!res.confirm) return;
        request({
          url: `/api/bookings/${bookingId}`,
          method: 'PUT',
          data: { status: 'cancelled' }
        }).then(() => {
          wx.showToast({ title: '已取消', icon: 'success' });
          this.loadSchedule();
        }).catch(() => {});
      }
    });
  },

  onShareAppMessage() {
    return {
      title: '友课 - 精选好课，预约学习',
      path: '/pages/booking/booking'
    };
  }
});
