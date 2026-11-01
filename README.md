# 💰 Personal Expense Tracker

A modern, responsive, full-stack **Personal Expense Tracker** web application engineered for a **B.Tech Information Technology Project**. Built using **Python Flask**, **MySQL**, **vanilla JavaScript (ES6+)**, and **Chart.js**.

---

## 🌟 Key Features

1. **📊 Page 1: Dashboard (Financial Overview)**
   - Real-time KPI summary cards: Total Expenses, Current Month's Expenses, Transaction Count, Highest Spending Category.
   - Monthly spending trend bar chart.
   - Category-wise spending doughnut chart.
   - Recent transactions table with instant action shortcuts.

2. **➕ Page 2: Add Expense**
   - Clean financial entry form: Date, Category, Description (max 100 chars), and Amount.
   - Fast 1-click category chips.
   - Live character counter and input validation.
   - Instant insertion into your existing MySQL `expenses` table via Flask API.
   - Toast notification feedback upon saving.

3. **📜 Page 3: Expense History**
   - Professional data table displaying: ID, Date, Category Badge, Description, Amount, Edit, and Delete actions.
   - Real-time search filter (searches description and category).
   - Category dropdown filter.
   - Date range filters (From Date, To Date) and quick preset buttons (*All Time*, *This Month*, *Last 30 Days*, *This Year*).
   - Sorting options (Date Newest/Oldest, Amount Highest/Lowest).
   - In-place Edit Modal with pre-populated records.
   - Confirmation Modal before deletion.
   - **Export to CSV**: Download filtered expense reports directly as `.csv` spreadsheets.

4. **📈 Page 4: Financial Analytics**
   - 4 interactive visualizations powered by Chart.js:
     1. **Monthly Spending Trend**: Bar & line chart showing spend volume and count.
     2. **Category Distribution**: Proportional doughnut chart.
     3. **Spending Trends**: 30-day continuous line chart.
     4. **Highest Expense Categories**: Ranked horizontal bar breakdown.
   - Financial KPIs: Average spending per transaction, Highest individual expense, and Lowest expense.
   - Top 5 Highest Transactions ranking table.

5. **🎯 Page 5: Budget Tracker**
   - Set monthly spending targets for individual categories.
   - Dynamic progress bars with color-coded status:
     - 🟢 **Safe** (< 70% utilized)
     - 🟡 **Warning** (70% - 85% utilized)
     - 🟠 **Near Limit** (85% - 100% utilized)
     - 🔴 **Over Budget** (> 100% exceeded)
   - Automatically maintains a dedicated `budgets` table without modifying the existing `expenses` table.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Custom Responsive Design, Glassmorphism, Dark/Light Themes), Modern JavaScript (ES6+), Font Awesome 6.5, Google Fonts (Inter & Outfit) |
| **Backend** | Python 3, Flask 3.x, Jinja2, python-dotenv |
| **Database** | MySQL Server (Connected via `mysql-connector-python` with connection pooling) |
| **Visualizations** | Chart.js 4.4 |

---

## 🗄️ Database Architecture

The application strictly connects to your existing MySQL database:

### 1. Existing Table: `expenses`
```sql
CREATE TABLE IF NOT EXISTS expenses (
    expense_id INT AUTO_INCREMENT PRIMARY KEY,
    expense_date DATE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description VARCHAR(100),
    amount DECIMAL(10,2) NOT NULL
);
```

### 2. Budget Table: `budgets` (Page 5)
*(Created automatically on startup if not already existing, leaving `expenses` completely untouched)*
```sql
CREATE TABLE IF NOT EXISTS budgets (
    budget_id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) NOT NULL UNIQUE,
    monthly_limit DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 🚀 Installation & Setup Guide (Windows)

### Step 1: Open PowerShell or Command Prompt
Navigate to the project root folder:
```powershell
cd c:\Users\HARSHITA\Downloads\Personal_Expense_Tracker_Website
```

### Step 2: Install Python Dependencies
Run:
```powershell
python -m pip install -r requirements.txt
```

### Step 3: Configure Database Credentials in `.env`
Open the `.env` file in any text editor (Notepad, VS Code) and verify your MySQL settings:

```ini
# Flask Configuration
FLASK_APP=app.py
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=expense_tracker_secret_key_change_in_production
PORT=5000

# MySQL Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=expense_tracker
DB_USER=root
DB_PASSWORD=your_mysql_password_here

# Currency Symbol
CURRENCY_SYMBOL=₹
```

> **Note on Dedicated Database User:**
> If you prefer connecting using a dedicated database user (e.g. `expense_user`), execute the included `setup_user.sql` in MySQL Workbench, phpMyAdmin, or MySQL CLI:
> ```sql
> CREATE USER IF NOT EXISTS 'expense_user'@'localhost' IDENTIFIED BY 'expense_secure_pass_123';
> GRANT ALL PRIVILEGES ON expense_tracker.* TO 'expense_user'@'localhost';
> FLUSH PRIVILEGES;
> ```
> Then set `DB_USER=expense_user` and `DB_PASSWORD=expense_secure_pass_123` in your `.env`.

---

### Step 4: Verify Database Connectivity
Before starting the web server, run the automated diagnostic script:
```powershell
python test_db.py
```
This script tests:
- MySQL server accessibility on port 3306.
- Authentication with credentials from `.env`.
- Verification of the existing `expenses` table schema and existing records.

---

### Step 5: Start the Flask Application
Run:
```powershell
python app.py
```

You will see output similar to:
```text
=================================================================
  🚀 PERSONAL EXPENSE TRACKER WEBSITE (Flask + MySQL)
  👉 Server Running at: http://127.0.0.1:5000
  👉 MySQL Host:        localhost:3306
  👉 Database:          expense_tracker
  👉 User:              root (or expense_user)
=================================================================
```

Open your web browser and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🧪 Testing All CRUD Operations

| Operation | Step-by-Step Instructions | Verification in MySQL |
| :--- | :--- | :--- |
| **CREATE (Add)** | 1. Navigate to **Add Expense**.<br>2. Select Date, Category (e.g. *Food & Dining*), enter Description (e.g. *College Canteen Lunch*), and Amount (e.g. `120.00`).<br>3. Click **Save Expense**.<br>4. A success toast appears. | `SELECT * FROM expenses ORDER BY expense_id DESC LIMIT 1;` |
| **READ (View/Filter)** | 1. Navigate to **Expense History**.<br>2. Use the **Search** input to find entries by keyword.<br>3. Change the Category filter or Date presets.<br>4. Verify the filtered count and sum dynamically update. | `SELECT * FROM expenses WHERE description LIKE '%canteen%';` |
| **UPDATE (Edit)** | 1. On **Expense History**, click the ✏️ **Edit** icon next to any transaction.<br>2. Change the amount or description in the popup modal.<br>3. Click **Save Changes**.<br>4. The table and dashboard refresh instantly. | `SELECT * FROM expenses WHERE expense_id = <ID>;` |
| **DELETE (Remove)** | 1. Click the 🗑️ **Trash** icon next to an expense.<br>2. Confirm the action in the safety dialog.<br>3. The record is permanently removed. | `SELECT * FROM expenses WHERE expense_id = <ID>;` (Returns empty) |
| **BUDGETS** | 1. Go to **Budget Tracker**.<br>2. Click **Set Category Budget**.<br>3. Set a limit for a category.<br>4. Observe the progress bar and status badge update based on current month's spend. | `SELECT * FROM budgets;` |
| **EXPORT** | 1. On **Expense History**, click **Export to CSV**.<br>2. A formatted `.csv` file downloads with all matching rows. | Open file in Excel / Google Sheets |

---

## 📡 RESTful API Documentation

| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & MySQL status |
| `GET` | `/api/expenses` | Fetch expenses (filters: `category`, `search`, `start_date`, `end_date`, `sort_by`) |
| `POST` | `/api/expenses` | Create new expense record |
| `GET` | `/api/expenses/<id>` | Fetch single expense details |
| `PUT` | `/api/expenses/<id>` | Update an existing expense |
| `DELETE` | `/api/expenses/<id>` | Delete an expense record |
| `GET` | `/api/dashboard/stats` | Aggregated metrics for Page 1 |
| `GET` | `/api/analytics` | Deep metrics & chart series for Page 4 |
| `GET` | `/api/budgets` | Fetch category budgets & utilization for Page 5 |
| `POST` | `/api/budgets` | Set or update a category budget limit |
| `DELETE` | `/api/budgets/<id>` | Remove a category budget |
| `GET` | `/api/export/csv` | Download CSV spreadsheet report |

---

## 📁 Project Directory Structure

```text
Personal_Expense_Tracker_Website/
│
├── app.py                     # Main Flask Application & REST API
├── requirements.txt           # Python dependencies
├── .env                       # Local MySQL & Flask configuration
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
├── setup_user.sql             # SQL script for dedicated user & optional demo data
├── test_db.py                 # MySQL connectivity diagnostic script
├── README.md                  # Project documentation & guide
│
├── templates/
│   └── index.html             # Master responsive dashboard template (Pages 1-5)
│
└── static/
    ├── css/
    │   └── styles.css         # Custom modern Fintech styling (Dark/Light themes)
    └── js/
        ├── app.js             # UI state, routing, CRUD, toasts, filters, modals
        └── charts.js          # Chart.js visualization engine
```

---

## 🛡️ Security & Best Practices

- **Parameterized SQL Queries**: All database queries use `%s` placeholders to eliminate SQL injection risks.
- **Credential Isolation**: Passwords and secrets are stored exclusively in `.env` and excluded via `.gitignore`.
- **Connection Pooling**: Uses `mysql.connector.pooling.MySQLConnectionPool` for thread safety and performance.
- **Graceful Error Handling**: Database connectivity failures or input validation issues return clean JSON responses and user-friendly banners without crashing the application.

---

🎓 **B.Tech Information Technology Project**
*Designed for academic evaluation, project viva, and enterprise-grade portfolio presentation.*
