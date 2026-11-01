-- ====================================================================
-- Database & Dedicated User Setup Script for Personal Expense Tracker
-- ====================================================================

-- 1. Create database (if not already existing)
CREATE DATABASE IF NOT EXISTS expense_tracker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE expense_tracker;

-- 2. Verify / Create expenses table (Matches existing schema)
CREATE TABLE IF NOT EXISTS expenses (
    expense_id INT AUTO_INCREMENT PRIMARY KEY,
    expense_date DATE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description VARCHAR(100),
    amount DECIMAL(10,2) NOT NULL
);

-- 3. Create budgets table for category budget tracking (Page 5)
CREATE TABLE IF NOT EXISTS budgets (
    budget_id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) NOT NULL UNIQUE,
    monthly_limit DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Create dedicated database user (Recommended for security)
-- You can change 'expense_secure_pass_123' to your desired password
CREATE USER IF NOT EXISTS 'expense_user'@'localhost' IDENTIFIED BY 'expense_secure_pass_123';

-- 5. Grant permissions to dedicated user on the expense_tracker database only
GRANT ALL PRIVILEGES ON expense_tracker.* TO 'expense_user'@'localhost';
FLUSH PRIVILEGES;

-- 6. Optional: Insert initial sample data for demonstration if table is empty
INSERT INTO expenses (expense_date, category, description, amount)
SELECT * FROM (
    SELECT '2026-11-01' AS expense_date, 'Food & Dining' AS category, 'Grocery shopping at Supermarket' AS description, 1450.00 AS amount UNION ALL
    SELECT '2026-11-01', 'Transportation', 'Monthly Metro Card Recharge', 800.00 UNION ALL
    SELECT '2026-10-30', 'Bills & Utilities', 'High-speed Fiber Internet Bill', 999.00 UNION ALL
    SELECT '2026-10-28', 'Entertainment', 'Movie tickets & snacks', 650.00 UNION ALL
    SELECT '2026-10-25', 'Education', 'Data Structures Reference Book', 550.00 UNION ALL
    SELECT '2026-10-22', 'Healthcare', 'Doctor Consultation & Pharmacy', 1200.00 UNION ALL
    SELECT '2026-10-18', 'Shopping', 'New Winter Jacket', 2499.00 UNION ALL
    SELECT '2026-10-15', 'Food & Dining', 'Dinner with College Friends', 1150.00 UNION ALL
    SELECT '2026-10-10', 'Bills & Utilities', 'Electricity Bill', 1850.00 UNION ALL
    SELECT '2026-10-05', 'Transportation', 'Cab ride to airport', 720.00
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM expenses LIMIT 1);

-- 7. Optional: Insert initial budget limits
INSERT INTO budgets (category, monthly_limit)
SELECT * FROM (
    SELECT 'Food & Dining' AS category, 5000.00 AS monthly_limit UNION ALL
    SELECT 'Transportation', 2500.00 UNION ALL
    SELECT 'Bills & Utilities', 4000.00 UNION ALL
    SELECT 'Entertainment', 2000.00 UNION ALL
    SELECT 'Shopping', 3500.00 UNION ALL
    SELECT 'Healthcare', 2000.00
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM budgets LIMIT 1);
