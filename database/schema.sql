-- C-Hub HR Admin Panel and ESS Dashboard MySQL Schema
-- Timezone Standard: Asia/Kolkata (IST)
-- Currency Standard: ₹ INR

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS `roles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) UNIQUE NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Permissions Table
CREATE TABLE IF NOT EXISTS `permissions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) UNIQUE NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Role Permissions Mapping Table
CREATE TABLE IF NOT EXISTS `role_permissions` (
    `role_id` INT NOT NULL,
    `permission_id` INT NOT NULL,
    PRIMARY KEY (`role_id`, `permission_id`),
    FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Users Table (Core Auth)
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(191) UNIQUE NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role_id` INT NOT NULL,
    `status` ENUM('active', 'inactive') DEFAULT 'active',
    `onboarding_completed` BOOLEAN DEFAULT FALSE,
    `reset_token_hash` VARCHAR(255) NULL,
    `reset_token_expires_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT,
    INDEX `idx_users_email` (`email`),
    INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Departments Table
CREATE TABLE IF NOT EXISTS `departments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) UNIQUE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Designations Table
CREATE TABLE IF NOT EXISTS `designations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) UNIQUE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Work Locations Table (Geofencing support)
CREATE TABLE IF NOT EXISTS `work_locations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `radius_meters` INT DEFAULT 100, -- Allowed geofence boundary radius
    `allow_without_location` BOOLEAN DEFAULT FALSE, -- Allow clock-in/out even if location denied
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Shifts Table
CREATE TABLE IF NOT EXISTS `shifts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) UNIQUE NOT NULL,
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    `grace_period_minutes` INT DEFAULT 15,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Employees Table
CREATE TABLE IF NOT EXISTS `employees` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNIQUE NULL, -- Null if not allowed to login yet
    `employee_id` VARCHAR(50) UNIQUE NOT NULL, -- e.g. CHUB-EMP-001
    `full_name` VARCHAR(255) NOT NULL,
    `mobile` VARCHAR(20) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `department_id` INT NULL,
    `designation_id` INT NULL,
    
    -- Address details
    `current_address` TEXT NULL,
    `permanent_address` TEXT NULL,
    `pincode` VARCHAR(10) NOT NULL,
    `country` VARCHAR(100) DEFAULT 'India',
    `state` VARCHAR(100) NULL,
    `district` VARCHAR(100) NULL,
    `post_office` VARCHAR(255) NULL,
    
    -- Onboarding and interview logs
    `interviewed_hrs` VARCHAR(255) NULL,
    `interviewed_date` DATE NULL,
    `appointed_date` DATE NULL,
    `contract_till_date` DATE NULL,
    
    -- Personal info
    `dob` DATE NULL,
    `gender` ENUM('Male', 'Female', 'Other') NULL,
    `blood_group` VARCHAR(10) NULL,
    `marital_status` ENUM('Single', 'Married', 'Divorced', 'Widowed') NULL,
    `nationality` VARCHAR(100) DEFAULT 'Indian',
    `citizenship_status` VARCHAR(100) DEFAULT 'Citizen',
    
    -- Emergency & alternate contacts
    `emergency_contact_name` VARCHAR(255) NULL,
    `emergency_contact_number` VARCHAR(20) NULL,
    `alt_mobile` VARCHAR(20) NULL,
    `alt_email` VARCHAR(191) NULL,
    
    -- Reporting Manager and location
    `reporting_manager_id` INT NULL, -- Self-reference to employee.id
    `work_location_id` INT NULL,
    `employment_type` ENUM('Full-time', 'Part-time', 'Intern', 'Consultant', 'Contract', 'Probation') DEFAULT 'Full-time',
    `joining_salary` DECIMAL(12, 2) DEFAULT 0.00,
    `probation_period_days` INT DEFAULT 180,
    `confirmation_date` DATE NULL,
    
    `photo_path` VARCHAR(255) NULL,
    `onboarding_status` ENUM('Draft', 'KYC Pending', 'HR Review', 'Approved', 'Rejected', 'Onboarding Completed') DEFAULT 'Draft',
    `status` ENUM('Active', 'Inactive') DEFAULT 'Active',
    
    `deleted_at` TIMESTAMP NULL, -- Soft delete support
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`designation_id`) REFERENCES `designations` (`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`work_location_id`) REFERENCES `work_locations` (`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`reporting_manager_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
    INDEX `idx_employees_id` (`employee_id`),
    INDEX `idx_employees_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Employee KYC Table (Encrypted sensitive fields stored inside code logic, masked by default)
CREATE TABLE IF NOT EXISTS `employee_kyc` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT UNIQUE NOT NULL,
    `aadhaar_number_encrypted` TEXT NULL, -- Encrypted Aadhaar Number
    `pan_number_encrypted` TEXT NULL, -- Encrypted PAN Number
    `bank_account_number_encrypted` TEXT NULL, -- Encrypted Bank Account Number
    `bank_name` VARCHAR(100) NULL,
    `bank_ifsc` VARCHAR(20) NULL,
    `upi_id` VARCHAR(100) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Employee Documents Table
CREATE TABLE IF NOT EXISTS `employee_documents` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `document_type` ENUM('Resume', 'Offer Letter', 'Appointment Letter', 'Contract Agreement', 'Education Certificate', 'Experience Certificate', 'ID Proof', 'Address Proof', 'Bank Proof', 'Other') NOT NULL,
    `document_name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(255) NOT NULL,
    `file_size` INT NOT NULL,
    `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Employee Shift Assignments Table
CREATE TABLE IF NOT EXISTS `employee_shift_assignments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `shift_id` INT NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL, -- Null if indefinitely assigned
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Attendance Logs Table (IST timezone)
CREATE TABLE IF NOT EXISTS `attendance_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `date` DATE NOT NULL,
    
    `clock_in_time` TIME NOT NULL,
    `clock_in_latitude` DECIMAL(10, 8) NULL,
    `clock_in_longitude` DECIMAL(11, 8) NULL,
    `clock_in_accuracy` DECIMAL(8, 2) NULL,
    `clock_in_ip` VARCHAR(45) NULL,
    `clock_in_user_agent` TEXT NULL,
    `clock_in_location_status` ENUM('Verified-Inside', 'Verified-Outside', 'Location Not Verified') DEFAULT 'Location Not Verified',
    
    `clock_out_time` TIME NULL,
    `clock_out_latitude` DECIMAL(10, 8) NULL,
    `clock_out_longitude` DECIMAL(11, 8) NULL,
    `clock_out_accuracy` DECIMAL(8, 2) NULL,
    `clock_out_ip` VARCHAR(45) NULL,
    `clock_out_user_agent` TEXT NULL,
    `clock_out_location_status` ENUM('Verified-Inside', 'Verified-Outside', 'Location Not Verified') DEFAULT 'Location Not Verified',
    
    `total_hours` DECIMAL(5, 2) DEFAULT 0.00,
    `status` ENUM('Present', 'Late', 'Half Day', 'Absent', 'Leave', 'Holiday', 'Work From Home', 'Location Not Verified') DEFAULT 'Present',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_emp_date` (`employee_id`, `date`),
    INDEX `idx_attendance_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Attendance Corrections Table
CREATE TABLE IF NOT EXISTS `attendance_corrections` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `attendance_log_id` INT NULL, -- Null if correcting a completely missing record
    `employee_id` INT NOT NULL,
    `date` DATE NOT NULL,
    `requested_clock_in` TIME NULL,
    `requested_clock_out` TIME NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    `approved_by` INT NULL,
    `approved_at` TIMESTAMP NULL,
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`attendance_log_id`) REFERENCES `attendance_logs` (`id`) ON DELETE SET NULL,
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Leave Types Table
CREATE TABLE IF NOT EXISTS `leave_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) UNIQUE NOT NULL,
    `code` VARCHAR(10) UNIQUE NOT NULL, -- CL, SL, EL
    `max_days` INT NOT NULL,
    `requires_medical_certificate_days` INT DEFAULT 3, -- Medical certificate mandatory if leave days >= this value
    `active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Leave Balances Table
CREATE TABLE IF NOT EXISTS `leave_balances` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `leave_type_id` INT NOT NULL,
    `total_days` DECIMAL(5, 2) NOT NULL,
    `availed_days` DECIMAL(5, 2) DEFAULT 0.00,
    `pending_days` DECIMAL(5, 2) DEFAULT 0.00,
    `year` INT NOT NULL,
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_emp_type_year` (`employee_id`, `leave_type_id`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Leave Requests Table
CREATE TABLE IF NOT EXISTS `leave_requests` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `leave_type_id` INT NOT NULL,
    `from_date` DATE NOT NULL,
    `to_date` DATE NOT NULL,
    `total_days` DECIMAL(5, 2) NOT NULL,
    `reason` TEXT NOT NULL,
    `attachment_path` VARCHAR(255) NULL,
    `status` ENUM('Pending', 'Approved', 'Rejected', 'Cancelled') DEFAULT 'Pending',
    `approved_by` INT NULL,
    `approved_at` TIMESTAMP NULL,
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Holidays Table
CREATE TABLE IF NOT EXISTS `holidays` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `date` DATE UNIQUE NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Immutable Audit Logs Table
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `action_type` VARCHAR(100) NOT NULL, -- e.g. VIEW_KYC, EDIT_EMPLOYEE, LOGIN_FAILED
    `performed_by` VARCHAR(255) NOT NULL, -- Email or system process
    `role` VARCHAR(50) NOT NULL,
    `target_record` VARCHAR(255) NULL, -- Table name / primary key identifier
    `old_value` TEXT NULL, -- Strictly JSON or text without sensitive fields
    `new_value` TEXT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `user_agent` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. Login History Table
CREATE TABLE IF NOT EXISTS `login_history` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `email_attempted` VARCHAR(191) NOT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `user_agent` TEXT NOT NULL,
    `status` ENUM('Success', 'Failed') NOT NULL,
    `remarks` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. System Settings Table
CREATE TABLE IF NOT EXISTS `system_settings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `setting_key` VARCHAR(100) UNIQUE NOT NULL,
    `setting_value` TEXT NOT NULL,
    `description` VARCHAR(255) NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. Security Events Table (alerts for audit purposes)
CREATE TABLE IF NOT EXISTS `security_events` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `severity` ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Low',
    `event_type` VARCHAR(100) NOT NULL, -- e.g. BRUTE_FORCE, SENSITIVE_DATA_BREACH
    `details` TEXT NOT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `user_agent` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
