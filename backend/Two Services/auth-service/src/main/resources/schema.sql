CREATE DATABASE IF NOT EXISTS bookvault;
USE bookvault;

DROP VIEW IF EXISTS USER_LOGINS_VIEW;
DROP VIEW IF EXISTS REGISTERED_USERS_VIEW;
DROP TABLE IF EXISTS BOOKS;
DROP TABLE IF EXISTS LOGIN_HISTORY;
DROP TABLE IF EXISTS APP_USERS;

CREATE TABLE APP_USERS (
    USER_ID         BIGINT       AUTO_INCREMENT PRIMARY KEY,
    NAME            VARCHAR(150) NOT NULL,
    EMAIL           VARCHAR(150) NOT NULL UNIQUE,
    PASSWORD        VARCHAR(255) NOT NULL DEFAULT 'face_biometric_auth',
    ROLE            VARCHAR(20)  NOT NULL DEFAULT 'READER',
    FACE_DESCRIPTOR LONGTEXT     NULL,
    CREATED_AT      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE LOGIN_HISTORY (
    LOG_ID         BIGINT       AUTO_INCREMENT PRIMARY KEY,
    USER_ID        BIGINT       NULL,
    USER_EMAIL     VARCHAR(150) NULL,
    USER_NAME      VARCHAR(100) NULL,
    AUTH_METHOD    VARCHAR(40)  NOT NULL,
    STATUS         VARCHAR(20)  NOT NULL,
    MATCH_DISTANCE DOUBLE       NULL,
    NOTE           VARCHAR(255) NULL,
    LOGIN_TIME     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE BOOKS (
    BOOK_ID            BIGINT        AUTO_INCREMENT PRIMARY KEY,
    USER_ID            BIGINT        NOT NULL,
    TITLE              VARCHAR(500)  NOT NULL,
    LANGUAGE           VARCHAR(20)   DEFAULT 'eng',
    COVER_IMAGE        LONGTEXT      NULL,
    FULL_TEXT          LONGTEXT      NULL,
    SOURCE             VARCHAR(50)   DEFAULT 'manual',
    LAST_POSITION_CHAR INT           DEFAULT 0,
    CREATED_AT         DATETIME      DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO APP_USERS (NAME, EMAIL, PASSWORD, ROLE, FACE_DESCRIPTOR)
VALUES ('Admin Reader', 'admin@readease.vault', '$2a$10$tPxG7R5B5cWbW1R3wV6O4O9V5tQ0Pz6wX2s7R9F5rY9U2z1e2c1q.', 'ADMIN', NULL);

INSERT INTO APP_USERS (NAME, EMAIL, PASSWORD, ROLE, FACE_DESCRIPTOR)
VALUES ('Enrolled Reader', 'enrolledreader@readease.vault', 'face_biometric_auth', 'READER', '[0.1, -0.2, 0.35]');

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

