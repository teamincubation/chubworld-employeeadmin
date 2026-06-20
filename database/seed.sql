-- C-Hub HR Admin Panel and ESS Dashboard PostgreSQL Seed Data (Supabase)
-- Default Super Admin Credentials:
-- Email: chub.admin@adloaf.com
-- Password: ChubAdmin$2027# (Hashed using bcrypt: $2a$10$i9j7LgA9.Pu5DxPpsi46i./HaTyvAIUTUODGuSbaux4rureerRBE.)

-- Disable triggers temporarily for bulk insert if needed
-- SET session_replication_role = 'replica';

-- Seed Roles
INSERT INTO roles (id, name, description) VALUES
(1, 'Super Admin', 'Total system control and security configuration'),
(2, 'Admin', 'Administrative control over employees, leaves and shifts'),
(3, 'HR Manager', 'Manages employee lifecycle, onboarding, and KYC verification'),
(4, 'Department Manager', 'Manages department-wise approvals and attendance reviews'),
(5, 'Finance Manager', 'Financial operations, payroll reports, and bank/UPI KYC details review'),
(6, 'Employee', 'Employee self-service (ESS) portal access');

-- Seed Permissions
INSERT INTO permissions (id, name, description) VALUES
(1, 'employee:view', 'View general employee details'),
(2, 'employee:create', 'Create and onboard new employees'),
(3, 'employee:edit', 'Modify existing employee profile data'),
(4, 'employee:delete', 'Soft-delete employee profiles'),
(5, 'employee:restore', 'Restore soft-deleted employee profiles'),
(6, 'kyc:view', 'View sensitive KYC data (Aadhaar, PAN, Bank/UPI details)'),
(7, 'attendance:view', 'View daily and historical attendance records'),
(8, 'attendance:edit', 'Manually correct or override attendance clockings'),
(9, 'leave:approve', 'Approve or reject leave requests'),
(10, 'leave:manage', 'Configure leave types, rules, and balances'),
(11, 'audit:view', 'Access immutable security audit logs'),
(12, 'payroll:view', 'Access financial and joining salary information'),
(13, 'role:manage', 'Manage roles and permission mappings'),
(14, 'security:settings', 'Manage IP blocks, rate limits, and geofencing coordinates');

-- Mapping Role Permissions
-- 1. Super Admin: All Permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10), (1, 11), (1, 12), (1, 13), (1, 14);

-- 2. Admin: Most Permissions (except role:manage and security:settings)
INSERT INTO role_permissions (role_id, permission_id) VALUES
(2, 1), (2, 2), (2, 3), (2, 4), (2, 6), (2, 7), (2, 8), (2, 9), (2, 10), (2, 11), (2, 12);

-- 3. HR Manager: Lifecycle, KYC, Leaves, Attendance View
INSERT INTO role_permissions (role_id, permission_id) VALUES
(3, 1), (3, 2), (3, 3), (3, 6), (3, 7), (3, 9), (3, 10);

-- 4. Department Manager: View and Approve local activities
INSERT INTO role_permissions (role_id, permission_id) VALUES
(4, 1), (4, 7), (4, 9);

-- 5. Finance Manager: View, Payroll, KYC
INSERT INTO role_permissions (role_id, permission_id) VALUES
(5, 1), (5, 6), (5, 12);

-- 6. Employee: Only basic view
INSERT INTO role_permissions (role_id, permission_id) VALUES
(6, 1), (6, 7);

-- Seed Initial Super Admin User (password: ChubAdmin$2027#)
INSERT INTO users (id, email, password_hash, role_id, status, onboarding_completed) VALUES
(1, 'chub.admin@adloaf.com', '$2a$10$i9j7LgA9.Pu5DxPpsi46i./HaTyvAIUTUODGuSbaux4rureerRBE.', 1, 'active', TRUE);

-- Create corresponding employee profile for Super Admin
INSERT INTO employees (id, user_id, employee_id, full_name, mobile, email, pincode, onboarding_status, status) VALUES
(1, 1, 'CHUB-EMP-001', 'System Super Admin', '9876543210', 'chub.admin@adloaf.com', '600001', 'Onboarding Completed', 'Active');

-- Seed Default Departments
INSERT INTO departments (id, name) VALUES
(1, 'Administration'),
(2, 'Human Resources'),
(3, 'Finance'),
(4, 'Technology & AI Dev'),
(5, 'EdTech Content & Learning'),
(6, 'Robotics & VR Lab');

-- Seed Default Designations
INSERT INTO designations (id, name) VALUES
(1, 'Chief Executive Officer'),
(2, 'Super Administrator'),
(3, 'HR Director'),
(4, 'Finance Manager'),
(5, 'Lead AI Developer'),
(6, 'VR Experience Designer'),
(7, 'Robotics Lead Mentor'),
(8, 'Senior EdTech Educator');

-- Seed Default Work Location (C-Hub Head Office in Kochi/Bangalore)
-- Coordinates around Kochi Infopark (10.0104, 76.3618)
INSERT INTO work_locations (id, name, latitude, longitude, radius_meters, allow_without_location) VALUES
(1, 'C-Hub Kochi Head Office', 10.01040000, 76.36180000, 200, FALSE);

-- Seed Default Shift (General Shift: 9:00 AM to 6:00 PM, Grace Period: 15 mins)
INSERT INTO shifts (id, name, start_time, end_time, grace_period_minutes) VALUES
(1, 'General Shift', '09:00:00', '18:00:00', 15),
(2, 'Morning Shift', '06:00:00', '15:00:00', 15),
(3, 'Evening Shift', '14:00:00', '23:00:00', 15);

-- Map Super Admin to Default Shift
INSERT INTO employee_shift_assignments (employee_id, shift_id, start_date) VALUES
(1, 1, '2026-01-01');

-- Seed Default Leave Types
INSERT INTO leave_types (id, name, code, max_days, requires_medical_certificate_days, active) VALUES
(1, 'Casual Leave', 'CL', 12, 3, TRUE),
(2, 'Sick Leave', 'SL', 8, 2, TRUE),
(3, 'Earned Leave / Privilege Leave', 'EL', 15, 5, TRUE);

-- Seed Leave Balance for Super Admin
INSERT INTO leave_balances (employee_id, leave_type_id, total_days, availed_days, pending_days, year) VALUES
(1, 1, 12, 0, 0, 2026),
(1, 2, 8, 0, 0, 2026),
(1, 3, 15, 0, 0, 2026);

-- Seed System Settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('company_name', 'C-Hub / Chubworld', 'The legal official company name display'),
('tagline', 'Creating Wow World', 'Branding tagline displayed on logins and dashboard'),
('geofence_enforced', 'true', 'Whether attendance clock-in requires matching work location radius coordinates'),
('smtp_host', 'mail.chubworld.com', 'Mail server host for password reset email dispatches'),
('smtp_port', '465', 'Secure mail server port'),
('smtp_user', 'no-reply@chubworld.com', 'System email account credentials'),
('smtp_pass', 'placeholder_smtp_pass', 'System email security password');

-- Seed Default Holidays for 2026 (IST)
INSERT INTO holidays (name, date, description) VALUES
('New Year Day', '2026-01-01', 'Global New Year celebration'),
('Republic Day', '2026-01-26', 'Indian Republic Day public holiday'),
('Independence Day', '2026-08-15', 'Indian Independence Day public holiday'),
('Gandhi Jayanti', '2026-10-02', 'Mahatma Gandhi Birthday public holiday'),
('Christmas Day', '2026-12-25', 'Christmas holiday');

-- Reset sequences to prevent duplicate key errors on future inserts since we forced IDs
SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));
SELECT setval('permissions_id_seq', (SELECT MAX(id) FROM permissions));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees));
SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));
SELECT setval('designations_id_seq', (SELECT MAX(id) FROM designations));
SELECT setval('work_locations_id_seq', (SELECT MAX(id) FROM work_locations));
SELECT setval('shifts_id_seq', (SELECT MAX(id) FROM shifts));
SELECT setval('leave_types_id_seq', (SELECT MAX(id) FROM leave_types));
SELECT setval('leave_balances_id_seq', (SELECT MAX(id) FROM leave_balances));
SELECT setval('system_settings_id_seq', (SELECT MAX(id) FROM system_settings));
SELECT setval('holidays_id_seq', (SELECT MAX(id) FROM holidays));

-- SET session_replication_role = 'origin';
