-- Migration to add document_number column to employee_documents and make file columns optional
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS document_number VARCHAR(100) NULL;
ALTER TABLE employee_documents ALTER COLUMN file_path DROP NOT NULL;
ALTER TABLE employee_documents ALTER COLUMN file_size DROP NOT NULL;
