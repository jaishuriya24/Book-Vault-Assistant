-- ============================================================================
-- BOOK VAULT / READEASE — CLEAN MYSQL SETUP SCRIPT
-- Database: bookvault  |  Host: 127.0.0.1:3306  |  User: root
-- ============================================================================

CREATE DATABASE IF NOT EXISTS bookvault;
USE bookvault;

-- Drop existing tables/views if they exist to perform a clean recreation
DROP VIEW IF EXISTS USER_LOGINS_VIEW;
DROP VIEW IF EXISTS REGISTERED_USERS_VIEW;
DROP TABLE IF EXISTS BOOKS;
DROP TABLE IF EXISTS LOGIN_HISTORY;
DROP TABLE IF EXISTS APP_USERS;

-- 1. APP_USERS TABLE
CREATE TABLE APP_USERS (
    USER_ID         BIGINT       AUTO_INCREMENT PRIMARY KEY,
    NAME            VARCHAR(150) NOT NULL,                 -- Display name shown in workbench
    EMAIL           VARCHAR(150) NOT NULL UNIQUE,          -- Internal system email
    PASSWORD        VARCHAR(255) NOT NULL DEFAULT 'face_biometric_auth',
    ROLE            VARCHAR(20)  NOT NULL DEFAULT 'READER', -- READER | ADMIN
    FACE_DESCRIPTOR LONGTEXT     NULL,                     -- JSON: 128-D float vector
    CREATED_AT      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. LOGIN_HISTORY TABLE
CREATE TABLE LOGIN_HISTORY (
    LOG_ID         BIGINT       AUTO_INCREMENT PRIMARY KEY,
    USER_ID        BIGINT       NULL,
    USER_EMAIL     VARCHAR(150) NULL,
    USER_NAME      VARCHAR(100) NULL,                      -- Name at time of login
    AUTH_METHOD    VARCHAR(40)  NOT NULL,                  -- FACE_RECOGNITION | VOICE | PASSWORD
    STATUS         VARCHAR(20)  NOT NULL,                  -- SUCCESS | FAILED
    MATCH_DISTANCE DOUBLE       NULL,
    NOTE           VARCHAR(255) NULL,
    LOGIN_TIME     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. BOOKS TABLE (from book-service)
CREATE TABLE BOOKS (
    BOOK_ID            BIGINT        AUTO_INCREMENT PRIMARY KEY,
    USER_ID            BIGINT        NOT NULL,
    TITLE              VARCHAR(500)  NOT NULL,
    LANGUAGE           VARCHAR(20)   DEFAULT 'eng',
    COVER_IMAGE        LONGTEXT      NULL,                      -- Added to save captured cover image
    FULL_TEXT          LONGTEXT      NULL,
    SOURCE             VARCHAR(50)   DEFAULT 'manual',
    LAST_POSITION_CHAR INT           DEFAULT 0,
    CREATED_AT         DATETIME      DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Admin User
-- Email: admin@readease.vault, Password: adminPassword123 (BCrypt hashed)
INSERT INTO APP_USERS (NAME, EMAIL, PASSWORD, ROLE, FACE_DESCRIPTOR)
VALUES ('Admin Reader', 'admin@readease.vault', '$2a$10$tPxG7R5B5cWbW1R3wV6O4O9V5tQ0Pz6wX2s7R9F5rY9U2z1e2c1q.', 'ADMIN', NULL);

-- Insert Default Biometric Enrolled Reader User (Dummy Face Descriptor template)
INSERT INTO APP_USERS (NAME, EMAIL, PASSWORD, ROLE, FACE_DESCRIPTOR)
VALUES ('Enrolled Reader', 'enrolledreader@readease.vault', 'face_biometric_auth', 'READER', '[0.1, -0.2, 0.35]');


-- ============================================================================
-- ★ TABLE VIEW 1 — USER TABLE
--   Paste this block alone in MySQL Workbench to see:
--   User ID | User Name | User Type | Biometric Login
-- ============================================================================
SELECT
    USER_ID                                                         AS 'User ID',
    NAME                                                            AS 'User Name',
    ROLE                                                            AS 'User Type',
    IF(FACE_DESCRIPTOR IS NOT NULL AND LENGTH(FACE_DESCRIPTOR) > 10,
       '✅ Biometric Enrolled',
       '🔑 Password Only')                                         AS 'Biometric Login',
    DATE_FORMAT(CREATED_AT, '%d %b %Y %H:%i')                      AS 'Registered At'
FROM APP_USERS
ORDER BY USER_ID ASC;


-- ============================================================================
-- ★ TABLE VIEW 2 — ADMIN LOGIN TABLE
--   Paste this block alone in MySQL Workbench to see:
--   User Name | Email ID | User ID | Login Time
-- ============================================================================
SELECT
    COALESCE(LH.USER_NAME, AU.NAME, 'Unknown')                     AS 'User Name',
    COALESCE(AU.EMAIL, LH.USER_EMAIL, '—')                         AS 'Email ID',
    LH.USER_ID                                                      AS 'User ID',
    DATE_FORMAT(LH.LOGIN_TIME, '%d %b %Y %H:%i:%s')                AS 'Login Time',
    LH.AUTH_METHOD                                                  AS 'Login Method',
    LH.STATUS                                                       AS 'Status',
    ROUND(LH.MATCH_DISTANCE, 4)                                    AS 'Face Distance'
FROM LOGIN_HISTORY LH
LEFT JOIN APP_USERS AU ON AU.USER_ID = LH.USER_ID
ORDER BY LH.LOGIN_TIME DESC
LIMIT 100;
