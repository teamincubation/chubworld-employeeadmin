-- 1. Create Admin Controller Role
INSERT INTO roles (id, name, description) 
VALUES (7, 'Admin Controller', 'Administrative controller who can manage sub-admins and share licensed modules') 
ON CONFLICT (id) DO NOTHING;

-- 2. Create Admin Controller Licensing Table
CREATE TABLE IF NOT EXISTS admin_controller_licensing (
    id SERIAL PRIMARY KEY,
    module_key VARCHAR(100) UNIQUE NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    subscription_start_date DATE NULL,
    subscription_end_date DATE NULL,
    feature_label VARCHAR(50) DEFAULT NULL
);

-- 3. Create Sub Admin Access Table
CREATE TABLE IF NOT EXISTS sub_admin_access (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_key VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    subscription_start_date DATE NULL,
    subscription_end_date DATE NULL,
    feature_label VARCHAR(50) DEFAULT NULL,
    UNIQUE(user_id, module_key)
);

-- 4. Add admin_creation_limit setting to system_settings
INSERT INTO system_settings (setting_key, setting_value, description) 
VALUES ('admin_creation_limit', '3', 'Max number of admins the Admin Controller can create') 
ON CONFLICT (setting_key) DO NOTHING;

-- 5. Seed default modules into admin_controller_licensing
INSERT INTO admin_controller_licensing (module_key, is_enabled) VALUES
('dashboard', TRUE),
('employees', TRUE),
('attendance', TRUE),
('leaves', TRUE),
('security', TRUE),
('reports', TRUE)
ON CONFLICT (module_key) DO NOTHING;

-- 6. Add mapping for Admin Controller Role Permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
(7, 1), (7, 2), (7, 3), (7, 4), (7, 6), (7, 7), (7, 8), (7, 9), (7, 10), (7, 11), (7, 12)
ON CONFLICT DO NOTHING;

-- 7. Create Admin Controller Access Control Table
CREATE TABLE IF NOT EXISTS admin_controller_access (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'Active', -- 'Active', 'Paused', 'Deactivated', 'Revoked'
    password_plain VARCHAR(255) NULL,
    activated_at TIMESTAMP NULL,
    total_active_seconds INT DEFAULT 0
);
