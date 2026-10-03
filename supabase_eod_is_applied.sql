ALTER TABLE hr_employee_transactions ADD COLUMN IF NOT EXISTS is_applied BOOLEAN DEFAULT FALSE;
UPDATE hr_employee_transactions SET is_applied = TRUE WHERE status = 'APPROVED';