-- SQL script to add full_name and email to admin_controller_access table
ALTER TABLE admin_controller_access ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE admin_controller_access ADD COLUMN IF NOT EXISTS email VARCHAR(191);
