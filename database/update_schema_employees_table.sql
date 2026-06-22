-- Alter employees table to add credentials, password_hash, and reset token columns
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255) NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP NULL;
