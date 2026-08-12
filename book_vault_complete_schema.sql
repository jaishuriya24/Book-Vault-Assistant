+------------------------- ============================================================================
-- BOOK VAULT — 2 TABLES SCHEMA (ZERO INSERTED DATA — 100% USER GIVEN)
-- Database: bookvault  |  Host: 127.0.0.1:3306
--
-- 1. admin_users     -> Admin Login (id, username, password, email, role, created_at)
-- 2. biometric_users -> Live User Face Login (user_id, name, biometric_saved)
--
-- NOTE: No hardcoded values inserted. All accounts will be created by live users.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS bookvault;
USE bookvault;

SET FOREIGN_KEY_CHECKS = 0;

-- Clean previous tables
DROP TABLE IF EXISTS bookmarks;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS login_history;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS standard_users;
DROP TABLE IF EXISTS app_users;
DROP TABLE IF EXISTS biometric_users;
DROP TABLE IF EXISTS admin_users;

-- ============================================================================
-- TABLE 1: ADMIN_USERS (Created empty — user will register admin account)
-- ============================================================================
CREATE TABLE admin_users (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    role        VARCHAR(20)  NOT NULL DEFAULT 'ADMIN',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE 2: BIOMETRIC_USERS (Created empty — user will enroll face via camera)
-- ============================================================================
CREATE TABLE biometric_users (
    user_id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
    name             VARCHAR(150) NOT NULL,
    biometric_saved  LONGTEXT     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- DISPLAY TABLES (Shows clean empty tables ready for live inputs)
-- ============================================================================

-- Result 1: Admin Table (0 rows until admin registers)
SELECT id, username, password, email, role, created_at FROM admin_users;

-- Result 2: User Biometric Table (0 rows until user registers face)
SELECT user_id, name, biometric_saved FROM biometric_users;
