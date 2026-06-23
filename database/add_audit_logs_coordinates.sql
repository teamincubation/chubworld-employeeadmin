-- Add latitude and longitude columns to audit_logs table for device signin location tracking
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8) NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) NULL;
