-- 1. Alter users table to add full_name for standalone accounts (Super Admin, Admin Controller, Sub Admins)
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) NULL;

-- 2. Map role permissions 13 (role:manage) and 14 (security:settings) to Admin Controller (role 7)
INSERT INTO role_permissions (role_id, permission_id) VALUES 
(7, 13), 
(7, 14) 
ON CONFLICT DO NOTHING;
