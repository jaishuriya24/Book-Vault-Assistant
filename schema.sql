CREATE DATABASE IF NOT EXISTS bookvault;
USE bookvault;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS bookmarks;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS login_history;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS standard_users;
DROP TABLE IF EXISTS app_users;
DROP TABLE IF EXISTS biometric_users;
DROP TABLE IF EXISTS admin_users;

CREATE TABLE admin_users (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    role        VARCHAR(20)  NOT NULL DEFAULT 'ADMIN',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE biometric_users (
    user_id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
    name             VARCHAR(150) NOT NULL,
    biometric_saved  LONGTEXT     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

SELECT id, username, password, email, role, created_at FROM admin_users;

SELECT user_id, name, biometric_saved FROM biometric_users;

