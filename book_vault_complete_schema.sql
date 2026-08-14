CREATE DATABASE IF NOT EXISTS bookvault;
USE bookvault;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS app_users;
CREATE TABLE app_users (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL DEFAULT 'face_biometric_auth',
    role            VARCHAR(20)  NOT NULL DEFAULT 'READER',
    face_descriptor LONGTEXT     NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS biometric_users;
CREATE TABLE biometric_users (
    user_id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    biometric_saved LONGTEXT     NOT NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS admin_users;
CREATE TABLE admin_users (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(150) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    role            VARCHAR(20)  NOT NULL DEFAULT 'ADMIN',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_users (username, password, email, role) 
VALUES ('admin123', 'admin123', 'admin@bookvault.io', 'ADMIN') 
ON DUPLICATE KEY UPDATE username=username, password='admin123';

DROP TABLE IF EXISTS login_history;
CREATE TABLE login_history (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT NULL,
    user_email      VARCHAR(150) NULL,
    user_name       VARCHAR(150) NULL,
    login_time      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    auth_method     VARCHAR(50) NULL,
    status          VARCHAR(20) NULL,
    match_distance  DOUBLE NULL,
    note            VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS booksaved;
CREATE TABLE booksaved (
    id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id            VARCHAR(100) DEFAULT 'Guest',
    user_name          VARCHAR(150) DEFAULT 'Reader',
    title              VARCHAR(500) NOT NULL,
    author             VARCHAR(255) DEFAULT 'Unknown',
    language           VARCHAR(20)  DEFAULT 'eng',
    full_text          LONGTEXT     NULL,
    content            LONGTEXT     NULL,
    cover_image        LONGTEXT     NULL,
    source             VARCHAR(50)  DEFAULT 'manual',
    last_position_char INT          DEFAULT 0,
    page_count         INT          DEFAULT 1,
    created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS pages;
CREATE TABLE pages (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    book_id         BIGINT NULL,
    page_number     INT NULL,
    image_data      LONGTEXT NULL,
    extracted_text  LONGTEXT NULL,
    dhash           VARCHAR(255) NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_book_page (book_id, page_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS bookmarks;
CREATE TABLE bookmarks (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id        VARCHAR(255) NULL,
    book_id        BIGINT NOT NULL,
    page_number    INT DEFAULT 1,
    char_position  INT DEFAULT 0,
    note           TEXT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bookmark_user_book (user_id, book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

SHOW TABLES;
