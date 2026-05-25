-- 友课小程序 MySQL 建表脚本
-- 使用方式：mysql -u root -p youke < schema.sql

CREATE DATABASE IF NOT EXISTS youke DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE youke;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(64) NOT NULL UNIQUE,
  nickname VARCHAR(50) DEFAULT '微信用户',
  avatar VARCHAR(500) DEFAULT '/images/avatar-default.png',
  points INT DEFAULT 0,
  total_checkins INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 帖子表
CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(64) NOT NULL,
  type VARCHAR(16) DEFAULT 'text',
  theme VARCHAR(100) DEFAULT '',
  content TEXT NOT NULL,
  video_url VARCHAR(500) DEFAULT '',
  avatar VARCHAR(500) DEFAULT '',
  username VARCHAR(50) DEFAULT '微信用户',
  likes INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_openid (openid),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 点赞表
CREATE TABLE IF NOT EXISTS post_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  openid VARCHAR(64) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_post_openid (post_id, openid),
  INDEX idx_post_id (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 收藏表
CREATE TABLE IF NOT EXISTS post_collects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  openid VARCHAR(64) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_post_openid (post_id, openid),
  INDEX idx_post_id (post_id),
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  openid VARCHAR(64) NOT NULL,
  nickname VARCHAR(50) DEFAULT '',
  avatar VARCHAR(500) DEFAULT '',
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_post_id (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 关注表
CREATE TABLE IF NOT EXISTS follows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(64) NOT NULL,
  following_openid VARCHAR(64) NOT NULL,
  following_name VARCHAR(50) DEFAULT '',
  following_avatar VARCHAR(500) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_follow (openid, following_openid),
  INDEX idx_openid (openid),
  INDEX idx_following (following_openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 预约表
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(64) NOT NULL,
  course_id INT NOT NULL,
  course_name VARCHAR(100) DEFAULT '',
  teacher VARCHAR(50) DEFAULT '',
  time VARCHAR(50) DEFAULT '',
  slot_id VARCHAR(20) DEFAULT '',
  status VARCHAR(20) DEFAULT 'booked',
  points_earned INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 积分日志表
CREATE TABLE IF NOT EXISTS points_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(64) NOT NULL,
  type VARCHAR(20) DEFAULT 'checkin',
  points INT DEFAULT 0,
  description VARCHAR(200) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
