// config/env.js

// 环境配置：只需修改这一个变量即可切换环境
const ENV = 'local'; // 'local' 或 'ecs'

const environments = {
  local: {
    BASE_URL: 'http://localhost:3000',
    name: '本地开发环境'
  },
  ecs: {
    BASE_URL: 'http://47.108.163.152:3000',
    name: 'ECS服务器环境'
  }
};

module.exports = {
  ENV,
  BASE_URL: environments[ENV].BASE_URL,
  ENV_NAME: environments[ENV].name
};
