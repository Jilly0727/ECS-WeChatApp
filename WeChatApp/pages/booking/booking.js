// pages/booking/booking.js
const app = getApp();
const { request } = require('../../utils/request');

Page({
  data: {
    timeSlots: [
      { id: 'morning', name: '上午 (09:00 - 12:00)' },
      { id: 'afternoon', name: '下午 (14:00 - 17:00)' },
      { id: 'evening', name: '晚上 (19:00 - 21:00)' }
    ],
    currentSlotId: 'morning',

    allCourses: [
      { id: 1, slotId: 'morning', name: '前端性能优化', teachers: ['森森老师', '杰老师'], selectedTeacher: '森森老师', time: '10月25日 10:00', booked: false, available: true },
      { id: 2, slotId: 'afternoon', name: 'React 源码解读', teachers: ['杰老师', 'Alex'], selectedTeacher: '杰老师', time: '10月26日 14:00', booked: false, available: true },
      { id: 3, slotId: 'evening', name: 'Node.js 进阶', teachers: ['森森老师'], selectedTeacher: '森森老师', time: '10月27日 19:00', booked: false, available: false },
      { id: 4, slotId: 'morning', name: 'Vue3 实战', teachers: ['杰老师', '森森老师'], selectedTeacher: '杰老师', time: '10月28日 10:00', booked: false, available: true }
    ],
    filteredCourses: []
  },

  onLoad() {
    this.filterByTimeSlot(this.data.currentSlotId);
    this.loadUserBookings();
  },

  onShow() {
    this.loadUserBookings();
  },

  loadUserBookings() {
    const openid = app.globalData.openid;
    if (!openid) return;

    request({
      url: '/api/bookings/status',
      method: 'GET',
      showLoading: false
    }).then(res => {
      const bookedIds = new Set((res.data || []).map(b => b.course_id || b.courseId));
      const updatedAll = this.data.allCourses.map(c => ({
        ...c,
        booked: bookedIds.has(c.id)
      }));
      const filtered = updatedAll.filter(item => item.slotId === this.data.currentSlotId);
      this.setData({ allCourses: updatedAll, filteredCourses: filtered });
    }).catch(err => {
      console.error('加载预约状态失败', err);
    });
  },

  onTimeSlotChange(e) {
    const slotId = e.currentTarget.dataset.id;
    this.setData({ currentSlotId: slotId });
    this.filterByTimeSlot(slotId);
  },

  filterByTimeSlot(slotId) {
    const filtered = this.data.allCourses.filter(item => item.slotId === slotId);
    this.setData({ filteredCourses: filtered });
  },

  onTeacherChange(e) {
    const id = e.currentTarget.dataset.id;
    const teacher = e.currentTarget.dataset.teacher;
    const filteredIndex = this.data.filteredCourses.findIndex(item => item.id === id);
    const allIndex = this.data.allCourses.findIndex(item => item.id === id);

    if (filteredIndex !== -1) {
      const updates = {
        [`filteredCourses[${filteredIndex}].selectedTeacher`]: teacher
      };
      if (allIndex !== -1) {
        updates[`allCourses[${allIndex}].selectedTeacher`] = teacher;
      }
      this.setData(updates);
    }
  },

  toggleBooking(e) {
    const id = e.currentTarget.dataset.id;
    const index = this.data.filteredCourses.findIndex(item => item.id === id);
    if (index === -1) return;

    const course = this.data.filteredCourses[index];
    if (!course.available && !course.booked) {
      wx.showToast({ title: '该时段已满员', icon: 'none' });
      return;
    }

    if (course.booked) {
      this.cancelBooking(course);
    } else {
      this.createBooking(course);
    }
  },

  createBooking(course) {
    const openid = app.globalData.openid;
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    request({
      url: '/api/bookings',
      method: 'POST',
      data: {
        courseId: course.id,
        courseName: course.name,
        teacher: course.selectedTeacher,
        time: course.time,
        slotId: course.slotId
      }
    }).then(() => {
      this.setLocalBooked(course.id, true);
      wx.showToast({ title: '已预约 ' + course.selectedTeacher, icon: 'success' });
    }).catch(() => {});
  },

  cancelBooking(course) {
    wx.showModal({
      title: '提示',
      content: '确定要取消预约吗？',
      success: (res) => {
        if (!res.confirm) return;
        const openid = app.globalData.openid;
        if (!openid) return;

        // 先查询booking id再取消
        request({
          url: '/api/bookings',
          method: 'GET',
          showLoading: false
        }).then(res => {
          const bookings = res.data || [];
          const booking = bookings.find(b =>
            b.courseId === course.id && b.status === 'booked'
          );
          if (booking && booking._id) {
            return request({
              url: `/api/bookings/${booking._id}`,
              method: 'PUT',
              data: { status: 'cancelled' }
            });
          }
        }).then(() => {
          this.setLocalBooked(course.id, false);
          wx.showToast({ title: '已取消', icon: 'success' });
        }).catch(err => {
          console.error('取消失败', err);
        });
      }
    });
  },

  setLocalBooked(courseId, booked) {
    const allIndex = this.data.allCourses.findIndex(c => c.id === courseId);
    const filteredIndex = this.data.filteredCourses.findIndex(c => c.id === courseId);
    const updates = {};
    if (allIndex !== -1) updates[`allCourses[${allIndex}].booked`] = booked;
    if (filteredIndex !== -1) updates[`filteredCourses[${filteredIndex}].booked`] = booked;
    if (Object.keys(updates).length > 0) this.setData(updates);
  }
});
