-- ============================================================================
-- NORMI ATTENDANCE SYSTEM - PRODUCTION DATABASE SCHEMA (MySQL 8.0+)
-- Institution: Northern Mindanao Colleges, Inc.
-- Target Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ============================================================================

-- 1. Create and select the database
CREATE DATABASE IF NOT EXISTS `normi_attendance`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `normi_attendance`;

-- 2. Safely disable foreign key checks during table setup
SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- TABLE: users (Administrative and Institutional Staff Accounts)
-- ============================================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` VARCHAR(64) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin', 'dean', 'instructor') NOT NULL DEFAULT 'instructor',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: colleges (Academic Colleges & Departments)
-- ============================================================================
DROP TABLE IF EXISTS `colleges`;
CREATE TABLE `colleges` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `dean_name` VARCHAR(150) NOT NULL DEFAULT '',
  `status` ENUM('Active', 'Archived') NOT NULL DEFAULT 'Active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_colleges_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: rooms (Laboratories and Classrooms)
-- ============================================================================
DROP TABLE IF EXISTS `rooms`;
CREATE TABLE `rooms` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `room_code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `building` VARCHAR(100) NOT NULL DEFAULT 'Main Building',
  `capacity` SMALLINT UNSIGNED NOT NULL DEFAULT 40,
  `college_id` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_rooms_room_code` (`room_code`),
  KEY `fk_rooms_colleges` (`college_id`),
  CONSTRAINT `fk_rooms_colleges` FOREIGN KEY (`college_id`) REFERENCES `colleges` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: devices (ESP32 RFID Scanner Hardware Terminals)
-- ============================================================================
DROP TABLE IF EXISTS `devices`;
CREATE TABLE `devices` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `device_uid` VARCHAR(60) NOT NULL,
  `room_id` INT UNSIGNED NOT NULL,
  `firmware_version` VARCHAR(40) NOT NULL DEFAULT 'v2.5.0-esp32',
  `api_key` VARCHAR(100) NOT NULL,
  `status` ENUM('online', 'offline') NOT NULL DEFAULT 'online',
  `last_heartbeat` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `offline_queue_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_devices_device_uid` (`device_uid`),
  UNIQUE KEY `idx_devices_api_key` (`api_key`),
  KEY `fk_devices_rooms` (`room_id`),
  CONSTRAINT `fk_devices_rooms` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: students (Enrolled Student Directory and RFID Badges)
-- ============================================================================
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_number` VARCHAR(30) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `college_id` INT UNSIGNED NOT NULL,
  `program` VARCHAR(100) NOT NULL DEFAULT '',
  `year_level` ENUM('1st Year', '2nd Year', '3rd Year', '4th Year') NOT NULL DEFAULT '1st Year',
  `rfid_uid` VARCHAR(32) NULL,
  `card_status` ENUM('active', 'lost', 'deactivated') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_students_number` (`student_number`),
  UNIQUE KEY `idx_students_rfid` (`rfid_uid`),
  KEY `fk_students_colleges` (`college_id`),
  CONSTRAINT `fk_students_colleges` FOREIGN KEY (`college_id`) REFERENCES `colleges` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: schedules (Academic Class Schedules & Subject Timetables)
-- ============================================================================
DROP TABLE IF EXISTS `schedules`;
CREATE TABLE `schedules` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `subject_code` VARCHAR(30) NOT NULL,
  `subject_name` VARCHAR(150) NOT NULL,
  `college_id` INT UNSIGNED NOT NULL,
  `room_id` INT UNSIGNED NOT NULL,
  `instructor_name` VARCHAR(150) NOT NULL,
  `day_of_week` ENUM('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat') NOT NULL DEFAULT 'Mon',
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `grace_minutes` TINYINT UNSIGNED NOT NULL DEFAULT 15,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_schedules_colleges` (`college_id`),
  KEY `fk_schedules_rooms` (`room_id`),
  CONSTRAINT `fk_schedules_colleges` FOREIGN KEY (`college_id`) REFERENCES `colleges` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_schedules_rooms` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: access_logs (RFID Card Scans & Real-Time Attendance Logs)
-- ============================================================================
DROP TABLE IF EXISTS `access_logs`;
CREATE TABLE `access_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `rfid_uid` VARCHAR(32) NOT NULL,
  `student_id` INT UNSIGNED NULL,
  `device_id` INT UNSIGNED NULL,
  `room_id` INT UNSIGNED NOT NULL,
  `schedule_id` INT UNSIGNED NULL,
  `log_type` ENUM('IN', 'OUT') NOT NULL DEFAULT 'IN',
  `attendance_status` ENUM('present', 'late', 'denied') NOT NULL DEFAULT 'present',
  `tapped_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `synced_from_offline` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_access_logs_tapped_at` (`tapped_at`),
  KEY `fk_logs_students` (`student_id`),
  KEY `fk_logs_devices` (`device_id`),
  KEY `fk_logs_rooms` (`room_id`),
  KEY `fk_logs_schedules` (`schedule_id`),
  CONSTRAINT `fk_logs_students` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_logs_devices` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_logs_rooms` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_logs_schedules` FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: attendance_overrides (Manual Instructor Attendance Overrides)
-- ============================================================================
DROP TABLE IF EXISTS `attendance_overrides`;
CREATE TABLE `attendance_overrides` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `schedule_id` INT UNSIGNED NOT NULL,
  `student_id` INT UNSIGNED NOT NULL,
  `override_date` DATE NOT NULL,
  `status` ENUM('present', 'late', 'absent', 'excused') NOT NULL DEFAULT 'present',
  `updated_by` VARCHAR(150) NOT NULL DEFAULT 'Super Admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_override_unique` (`schedule_id`, `student_id`, `override_date`),
  KEY `fk_overrides_schedules` (`schedule_id`),
  KEY `fk_overrides_students` (`student_id`),
  CONSTRAINT `fk_overrides_schedules` FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_overrides_students` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key constraints
SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

-- ============================================================================
-- SEED: Preserved Super Admin Account (Production Login Ready)
-- ============================================================================
INSERT INTO `users` (
  `id`,
  `full_name`,
  `email`,
  `password_hash`,
  `role`,
  `is_active`,
  `created_at`,
  `updated_at`
) VALUES (
  '800a7970-8c0f-45e4-aa88-bb4006a14921',
  'NORMI Super Admin',
  'admin@normi.edu.ph',
  'scrypt$b0c5005ace16031f9ba76607b81dd106$f12336a245ba084ca9d6f98281d5fbe72f2d5b509e4bc3dae5661c21ed17898e1d9e4c28c4ab0f463c6fd6cce0db55e9c171fbf29c31df175c533d1658fee56e',
  'super_admin',
  1,
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE `email` = `email`;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
SELECT 'users' AS `table_name`, COUNT(*) AS `record_count` FROM `users`
UNION ALL
SELECT 'colleges', COUNT(*) FROM `colleges`
UNION ALL
SELECT 'rooms', COUNT(*) FROM `rooms`
UNION ALL
SELECT 'devices', COUNT(*) FROM `devices`
UNION ALL
SELECT 'students', COUNT(*) FROM `students`
UNION ALL
SELECT 'schedules', COUNT(*) FROM `schedules`
UNION ALL
SELECT 'access_logs', COUNT(*) FROM `access_logs`;
