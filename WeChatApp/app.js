// app.js
const { request } = require('./utils/request');

App({
  globalData: {
    userInfo: null,
    openid: null,
    token: null,
    isLogin: false
  },

  onLaunch() {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
    this.login();
  },

  login(callback) {
    wx.login({
      success: res => {
        if (res.code) {
          request({
            url: '/api/login',
            method: 'POST',
            data: { code: res.code },
            showLoading: false
          }).then(loginRes => {
            const { token, userInfo } = loginRes.data;
            this.globalData.token = token;
            this.globalData.userInfo = userInfo;
            this.globalData.openid = userInfo.openid;
            this.globalData.isLogin = true;

            if (callback) {
              callback(userInfo);
            }
          }).catch(err => {
            console.error('登录请求失败', err);
          });
        }
      }
    });
  }
});
