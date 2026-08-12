-- ========================================================
-- Database Schema for Book-Vault-main
-- Table Name: booksaved
-- Database: bookvault
-- ========================================================

CREATE DATABASE IF NOT EXISTS bookvault;
USE bookvault;

CREATE TABLE IF NOT EXISTS booksaved (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(100) DEFAULT 'Guest',
  user_name VARCHAR(150) DEFAULT 'Reader',
  title VARCHAR(255) NOT NULL,
  author VARCHAR(150) DEFAULT 'Unknown',
  language VARCHAR(20) DEFAULT 'eng',
  full_text LONGTEXT,
  content LONGTEXT,
  cover_image LONGTEXT,
  source VARCHAR(50) DEFAULT 'manual',
  last_position_char INT DEFAULT 0,
  page_count INT DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
