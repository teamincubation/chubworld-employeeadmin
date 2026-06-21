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
    feature_label VARCHAR(50) DEFAULT NULL -- 'Beta', 'Trial', 'Premium', or NULL
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
