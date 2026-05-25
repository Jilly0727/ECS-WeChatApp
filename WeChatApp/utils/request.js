// utils/request.js
const { BASE_URL, ENV_NAME } = require('../config/env.js');

console.log(`当前环境: ${ENV_NAME}, API地址: ${BASE_URL}`);

/**
 * 封装 wx.request
 * @param {Object} options - 请求配置
 * @returns {Promise}
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const app = getApp();
    const token = app.globalData.token;

    const header = {
      'content-type': 'application/json',
      ...options.header
    };

    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }

    if (options.showLoading !== false) {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });
    }

    wx.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: header,
      success: (res) => {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
          if (res.data.success) {
            resolve(res.data);
          } else {
            wx.showToast({
              title: res.data.message || '请求失败',
              icon: 'none'
            });
            reject(res.data);
          }
        } else if (res.statusCode === 401) {
          wx.showToast({ title: '登录已过期', icon: 'none' });
          reject(res);
        } else {
          wx.showToast({
            title: `服务器错误: ${res.statusCode}`,
            icon: 'none'
          });
          reject(res);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '网络连接异常',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
}

module.exports = {
  request
};