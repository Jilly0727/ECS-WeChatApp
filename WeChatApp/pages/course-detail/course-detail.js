// pages/course-detail/course-detail.js
const app = getApp();
const { request } = require('../../utils/request');

Page({
  data: {
    course: null,
    isBooked: false,
    bookingInProgress: false
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '课程不存在', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this.loadCourse(id);
  },

  onShow() {
    if (this.data.course) {
      this.loadCourse(this.data.course.id);
    }
  },

  loadCourse(id) {
    wx.showLoading({ title: '加载中...' });
    request({
      url: `/api/courses/${id}`,
      method: 'GET',
      showLoading: false
    }).then(res => {
      wx.hideLoading();
      if (res.data) {
        this.setData({
          course: res.data,
          isBooked: res.data.isBooked || false
        });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  toggleBooking() {
    const { course, isBooked, bookingInProgress } = this.data;
    if (bookingInProgress) return;

    if (isBooked) {
      this.cancelBooking();
    } else {
      this.createBooking();
    }
  },

  createBooking() {
    const course = this.data.course;
    if (!course.available) {
      wx.showToast({ title: '该课程已满员', icon: 'none' });
      return;
    }

    this.setData({ bookingInProgress: true });
    request({
      url: '/api/bookings',
      method: 'POST',
      data: {
        courseId: course.id,
        courseName: course.name,
        teacher: course.teacher,
        time: course.time,
        slotId: course.slotId
      }
    }).then(() => {
      this.setData({ isBooked: true, bookingInProgress: false });
      wx.showToast({ title: '预约成功', icon: 'success' });
    }).catch(() => {
      this.setData({ bookingInProgress: false });
    });
  },

  cancelBooking() {
    this.setData({ bookingInProgress: true });
    request({
      url: '/api/bookings',
      method: 'GET',
      showLoading: false
    }).then(res => {
      const bookings = res.data || [];
      const booking = bookings.find(b =>
        b.courseId === this.data.course.id && b.status === 'booked'
      );
      if (booking && booking._id) {
        return request({
          url: `/api/bookings/${booking._id}`,
          method: 'PUT',
          data: { status: 'cancelled' }
        });
      }
    }).then(() => {
      this.setData({ isBooked: false, bookingInProgress: false });
      wx.showToast({ title: '已取消', icon: 'success' });
    }).catch(() => {
      this.setData({ bookingInProgress: false });
    });
  },

  previewImage() {
    const { course } = this.data;
    if (course && course.image) {
      wx.previewImage({ urls: [course.image] });
    }
  },

  onShareAppMessage() {
    const { course } = this.data;
    return {
      title: course ? `${course.name} - ${course.teacher}` : '有课预约',
      path: `/pages/course-detail/course-detail?id=${course ? course.id : ''}`,
      imageUrl: course ? course.image : ''
    };
  }
});
