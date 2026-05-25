// pages/index/index.js
Page({
  data: {
    recommendCourses: [
      { id: 1, name: 'JavaScript 高级程序设计', teacher: '张三老师', image: '/images/js.png' },
      { id: 2, name: 'Vue3 核心原理解析', teacher: '李四老师', image: '/images/vue.png' },
      { id: 3, name: '微信小程序实战开发', teacher: '王五老师', image: '/images/wx.png' }
    ]
  },

  goToCommunity() {
    wx.switchTab({
      url: '/pages/youda/youda'
    });
  },

  goToRecords() {
    // 注意：这里必须使用 wx.navigateTo，因为 my-records 不是 TabBar 页面
    wx.navigateTo({
      url: '/pages/my-records/my-records'
    });
  },

  goToBooking() {
    // 注意：如果 booking 是 TabBar 页面，必须使用 switchTab
    // 如果 booking 只是普通页面，请使用 navigateTo
    // 根据 app.json 配置，booking 是 TabBar 页面，所以这里用 switchTab
    wx.switchTab({
      url: '/pages/booking/booking'
    });
  }
});