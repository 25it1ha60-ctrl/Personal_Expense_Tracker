"""
====================================================================
Personal Expense Tracker - Flask Application Backend
====================================================================
Technology Stack:
- Python Flask
- MySQL Database (mysql-connector-python)
- RESTful JSON APIs & Server-side templating
====================================================================
"""

import os
import io
import csv
from datetime import datetime, date
from decimal import Decimal
from flask import Flask, render_template, request, jsonify, Response, send_file
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import Error, pooling

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'expense_tracker_btech_secret_key_2026')

# Database Configuration from Environment Variables
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'expense_tracker'),
    'charset': 'utf8mb4',
    'autocommit': True
}

CURRENCY_SYMBOL = os.getenv('CURRENCY_SYMBOL', '₹')

# Initialize Connection Pool
db_pool = None
try:
    db_pool = pooling.MySQLConnectionPool(
        pool_name="expense_pool",
        pool_size=5,
        pool_reset_session=True,
        **DB_CONFIG
    )
    print(f"[+] MySQL Connection Pool initialized successfully ({DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']})")
except Error as e:
    print(f"[!] Warning: Initial connection pool creation failed: {e.msg}")
    print("[!] Flask will attempt on-demand connections on each request.")


def get_db_connection():
    """
    Acquires a connection to MySQL, either from pool or fresh connection.
    Returns:
        mysql.connector.connection_cext.CMySQLConnection: Database connection object
    Raises:
        mysql.connector.Error: If connection fails
    """
    global db_pool
    if db_pool:
        try:
            return db_pool.get_connection()
        except Error:
            # Recreate pool if exhausted or closed
            pass

    return mysql.connector.connect(**DB_CONFIG)


def init_additional_tables():
    """
    Ensures the optional 'budgets' table exists for Page 5 (Budget Tracker).
    IMPORTANT: This leaves the existing 'expenses' table completely untouched.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        create_budgets_table_query = """
        CREATE TABLE IF NOT EXISTS budgets (
            budget_id INT AUTO_INCREMENT PRIMARY KEY,
            category VARCHAR(50) NOT NULL UNIQUE,
            monthly_limit DECIMAL(10,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """
        cursor.execute(create_budgets_table_query)
        cursor.close()
        conn.close()
        print("[+] Budgets table verified/ready in MySQL database.")
    except Error as e:
        print(f"[!] Note on table verification: {e.msg}")


# Run table initialization on startup
try:
    init_additional_tables()
except Exception as ex:
    print(f"[!] Database startup check skipped (MySQL server may need to be started): {ex}")


@app.context_processor
def inject_global_vars():
    """Injects common variables like currency symbol and current year to Jinja templates."""
    return {
        'currency_symbol': CURRENCY_SYMBOL,
        'current_year': datetime.now().year,
        'current_date': datetime.now().strftime('%Y-%m-%d')
    }


def serialize_row(row):
    """
    Helper function to convert Decimal and Date objects in MySQL rows to JSON serializable formats.
    """
    if not row:
        return row
    result = {}
    for key, value in row.items():
        if isinstance(value, (Decimal, float)):
            result[key] = float(value)
        elif isinstance(value, (date, datetime)):
            result[key] = value.strftime('%Y-%m-%d')
        else:
            result[key] = value
    return result


# ====================================================================
# FRONTEND PAGE ROUTES
# ====================================================================

@app.route('/')
@app.route('/dashboard')
def dashboard_page():
    """Page 1: Dashboard"""
    return render_template('index.html', active_tab='dashboard')


@app.route('/add-expense')
def add_expense_page():
    """Page 2: Add Expense"""
    return render_template('index.html', active_tab='add-expense')


@app.route('/history')
def history_page():
    """Page 3: Expense History"""
    return render_template('index.html', active_tab='history')


@app.route('/analytics')
def analytics_page():
    """Page 4: Analytics"""
    return render_template('index.html', active_tab='analytics')


@app.route('/budgets')
def budgets_page():
    """Page 5: Budget Tracker"""
    return render_template('index.html', active_tab='budgets')


# ====================================================================
# BACKEND API ENDPOINTS
# ====================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Check health and MySQL connectivity."""
    db_status = False
    message = "MySQL disconnected"
    table_info = {}

    try:
        conn = get_db_connection()
        if conn.is_connected():
            db_status = True
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT COUNT(*) AS total_count FROM expenses;")
            res = cursor.fetchone()
            table_info['expenses_count'] = res['total_count'] if res else 0
            cursor.close()
            conn.close()
            message = "MySQL connected successfully"
    except Error as e:
        message = f"MySQL Error: {e.msg}"

    return jsonify({
        'status': 'healthy' if db_status else 'degraded',
        'database_connected': db_status,
        'message': message,
        'database_name': DB_CONFIG['database'],
        'table_info': table_info
    })


# --------------------------------------------------------------------
# EXPENSE CRUD ENDPOINTS
# --------------------------------------------------------------------

@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    """
    Fetch all expenses with optional search, category, and date filtering.
    Query Parameters:
      - category: Filter by category name
      - search: Search in description and category
      - start_date: YYYY-MM-DD
      - end_date: YYYY-MM-DD
      - sort_by: date_desc (default), date_asc, amount_desc, amount_asc
      - limit: Max number of records to return
    """
    try:
        category = request.args.get('category', '').strip()
        search = request.args.get('search', '').strip()
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        sort_by = request.args.get('sort_by', 'date_desc').strip()
        limit = request.args.get('limit', type=int)

        query = "SELECT expense_id, expense_date, category, description, amount FROM expenses WHERE 1=1"
        params = []

        if category and category.lower() != 'all':
            query += " AND category = %s"
            params.append(category)

        if search:
            query += " AND (description LIKE %s OR category LIKE %s)"
            search_param = f"%{search}%"
            params.extend([search_param, search_param])

        if start_date:
            query += " AND expense_date >= %s"
            params.append(start_date)

        if end_date:
            query += " AND expense_date <= %s"
            params.append(end_date)

        # Sorting
        sort_map = {
            'date_desc': " ORDER BY expense_date DESC, expense_id DESC",
            'date_asc': " ORDER BY expense_date ASC, expense_id ASC",
            'amount_desc': " ORDER BY amount DESC, expense_date DESC",
            'amount_asc': " ORDER BY amount ASC, expense_date DESC"
        }
        query += sort_map.get(sort_by, sort_map['date_desc'])

        if limit and limit > 0:
            query += " LIMIT %s"
            params.append(limit)

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        expenses = [serialize_row(r) for r in rows]
        return jsonify({
            'success': True,
            'count': len(expenses),
            'expenses': expenses
        })

    except Error as e:
        return jsonify({
            'success': False,
            'error': f"Database query error: {e.msg}"
        }), 500


@app.route('/api/expenses', methods=['POST'])
def add_expense():
    """
    Create a new expense record in the existing MySQL 'expenses' table.
    Payload:
      - expense_date: YYYY-MM-DD
      - category: string (max 50)
      - description: string (max 100)
      - amount: positive float / decimal
    """
    try:
        data = request.get_json(force=True, silent=True) or request.form.to_dict()

        expense_date = data.get('expense_date', '').strip()
        category = data.get('category', '').strip()
        description = data.get('description', '').strip()
        amount_raw = data.get('amount')

        # Input Validation
        if not expense_date:
            return jsonify({'success': False, 'error': 'Expense date is required.'}), 400

        try:
            datetime.strptime(expense_date, '%Y-%m-%d')
        except ValueError:
            return jsonify({'success': False, 'error': 'Invalid date format. Use YYYY-MM-DD.'}), 400

        if not category:
            return jsonify({'success': False, 'error': 'Category is required.'}), 400
        if len(category) > 50:
            return jsonify({'success': False, 'error': 'Category name cannot exceed 50 characters.'}), 400

        if description and len(description) > 100:
            return jsonify({'success': False, 'error': 'Description cannot exceed 100 characters.'}), 400

        try:
            amount = float(amount_raw)
            if amount <= 0:
                return jsonify({'success': False, 'error': 'Amount must be greater than zero.'}), 400
            if amount > 99999999.99:
                return jsonify({'success': False, 'error': 'Amount exceeds permissible limit.'}), 400
        except (TypeError, ValueError):
            return jsonify({'success': False, 'error': 'Valid numeric amount is required.'}), 400

        # Parameterized Insert Query
        insert_query = """
        INSERT INTO expenses (expense_date, category, description, amount)
        VALUES (%s, %s, %s, %s)
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(insert_query, (expense_date, category, description, amount))
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'message': 'Expense saved successfully to database.',
            'expense': {
                'expense_id': new_id,
                'expense_date': expense_date,
                'category': category,
                'description': description,
                'amount': amount
            }
        }), 201

    except Error as e:
        return jsonify({
            'success': False,
            'error': f"Failed to save expense in MySQL: {e.msg}"
        }), 500


@app.route('/api/expenses/<int:expense_id>', methods=['GET'])
def get_single_expense(expense_id):
    """Fetch details of a single expense by ID."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT expense_id, expense_date, category, description, amount FROM expenses WHERE expense_id = %s", (expense_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not row:
            return jsonify({'success': False, 'error': 'Expense not found.'}), 404

        return jsonify({
            'success': True,
            'expense': serialize_row(row)
        })
    except Error as e:
        return jsonify({'success': False, 'error': f"Database error: {e.msg}"}), 500


@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    """
    Update an existing expense in the MySQL 'expenses' table.
    """
    try:
        data = request.get_json(force=True, silent=True) or request.form.to_dict()

        expense_date = data.get('expense_date', '').strip()
        category = data.get('category', '').strip()
        description = data.get('description', '').strip()
        amount_raw = data.get('amount')

        # Input Validation
        if not expense_date:
            return jsonify({'success': False, 'error': 'Expense date is required.'}), 400
        try:
            datetime.strptime(expense_date, '%Y-%m-%d')
        except ValueError:
            return jsonify({'success': False, 'error': 'Invalid date format. Use YYYY-MM-DD.'}), 400

        if not category:
            return jsonify({'success': False, 'error': 'Category is required.'}), 400
        if len(category) > 50:
            return jsonify({'success': False, 'error': 'Category name cannot exceed 50 characters.'}), 400

        if description and len(description) > 100:
            return jsonify({'success': False, 'error': 'Description cannot exceed 100 characters.'}), 400

        try:
            amount = float(amount_raw)
            if amount <= 0:
                return jsonify({'success': False, 'error': 'Amount must be greater than zero.'}), 400
        except (TypeError, ValueError):
            return jsonify({'success': False, 'error': 'Valid numeric amount is required.'}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Check existence
        cursor.execute("SELECT expense_id FROM expenses WHERE expense_id = %s", (expense_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'error': f'Expense #{expense_id} not found.'}), 404

        # Parameterized Update Query
        update_query = """
        UPDATE expenses
        SET expense_date = %s, category = %s, description = %s, amount = %s
        WHERE expense_id = %s
        """
        cursor.execute(update_query, (expense_date, category, description, amount, expense_id))
        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'message': f'Expense #{expense_id} updated successfully.',
            'expense': {
                'expense_id': expense_id,
                'expense_date': expense_date,
                'category': category,
                'description': description,
                'amount': amount
            }
        })

    except Error as e:
        return jsonify({'success': False, 'error': f"Failed to update expense: {e.msg}"}), 500


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    """Delete an expense record by ID."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT expense_id FROM expenses WHERE expense_id = %s", (expense_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'error': f'Expense #{expense_id} not found.'}), 404

        cursor.execute("DELETE FROM expenses WHERE expense_id = %s", (expense_id,))
        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'message': f'Expense #{expense_id} has been permanently deleted.'
        })

    except Error as e:
        return jsonify({'success': False, 'error': f"Failed to delete expense: {e.msg}"}), 500


# --------------------------------------------------------------------
# PAGE 1: DASHBOARD STATS ENDPOINT
# --------------------------------------------------------------------

@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """
    Returns metrics required for Page 1 (Dashboard):
    1. Total expenses (all-time)
    2. Current month's expenses
    3. Number of transactions
    4. Highest spending category
    5. Monthly spending bar chart data
    6. Category-wise spending doughnut chart data
    7. Recent transactions
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. Total expenses & Total transaction count
        cursor.execute("""
            SELECT 
                COALESCE(SUM(amount), 0) AS total_amount,
                COUNT(*) AS total_count
            FROM expenses;
        """)
        overall = cursor.fetchone() or {'total_amount': 0, 'total_count': 0}
        total_expenses = float(overall['total_amount'])
        total_transactions = int(overall['total_count'])

        # 2. Current Month's expenses
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) AS current_month_amount,
                   COUNT(*) AS current_month_count
            FROM expenses
            WHERE YEAR(expense_date) = YEAR(CURRENT_DATE())
              AND MONTH(expense_date) = MONTH(CURRENT_DATE());
        """)
        curr_month = cursor.fetchone() or {'current_month_amount': 0, 'current_month_count': 0}
        current_month_expenses = float(curr_month['current_month_amount'])
        current_month_count = int(curr_month['current_month_count'])

        # Previous Month's expenses (for trend percentage indicator)
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) AS prev_month_amount
            FROM expenses
            WHERE YEAR(expense_date) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH)
              AND MONTH(expense_date) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH);
        """)
        prev_month = cursor.fetchone() or {'prev_month_amount': 0}
        prev_month_expenses = float(prev_month['prev_month_amount'])

        # Monthly comparison percentage
        if prev_month_expenses > 0:
            month_pct_change = round(((current_month_expenses - prev_month_expenses) / prev_month_expenses) * 100, 1)
        else:
            month_pct_change = 100.0 if current_month_expenses > 0 else 0.0

        # 3. Highest spending category (all-time or this month)
        cursor.execute("""
            SELECT category, SUM(amount) AS total_spent
            FROM expenses
            GROUP BY category
            ORDER BY total_spent DESC
            LIMIT 1;
        """)
        top_cat = cursor.fetchone()
        highest_category = {
            'category': top_cat['category'] if top_cat else 'None',
            'amount': float(top_cat['total_spent']) if top_cat else 0.0
        }

        # 4. Monthly Spending Bar Chart Data (Last 6 Months)
        cursor.execute("""
            SELECT 
                DATE_FORMAT(expense_date, '%Y-%m') AS month_key,
                DATE_FORMAT(expense_date, '%b %Y') AS month_label,
                COALESCE(SUM(amount), 0) AS total_amount,
                COUNT(*) AS count
            FROM expenses
            WHERE expense_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
            GROUP BY month_key, month_label
            ORDER BY month_key ASC;
        """)
        monthly_trend_rows = cursor.fetchall()
        monthly_trend = [serialize_row(r) for r in monthly_trend_rows]

        # 5. Category-wise Spending Doughnut Chart Data
        cursor.execute("""
            SELECT 
                category,
                COALESCE(SUM(amount), 0) AS total_amount,
                COUNT(*) AS count
            FROM expenses
            GROUP BY category
            ORDER BY total_amount DESC;
        """)
        category_rows = cursor.fetchall()
        category_breakdown = []
        for row in category_rows:
            item = serialize_row(row)
            item['percentage'] = round((item['total_amount'] / total_expenses * 100), 1) if total_expenses > 0 else 0
            category_breakdown.append(item)

        # 6. Recent Transactions (Latest 7)
        cursor.execute("""
            SELECT expense_id, expense_date, category, description, amount
            FROM expenses
            ORDER BY expense_date DESC, expense_id DESC
            LIMIT 7;
        """)
        recent_rows = cursor.fetchall()
        recent_transactions = [serialize_row(r) for r in recent_rows]

        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'summary': {
                'total_expenses': total_expenses,
                'total_transactions': total_transactions,
                'current_month_expenses': current_month_expenses,
                'current_month_count': current_month_count,
                'prev_month_expenses': prev_month_expenses,
                'month_pct_change': month_pct_change,
                'highest_category': highest_category
            },
            'monthly_trend': monthly_trend,
            'category_breakdown': category_breakdown,
            'recent_transactions': recent_transactions
        })

    except Error as e:
        return jsonify({'success': False, 'error': f"Failed to calculate dashboard statistics: {e.msg}"}), 500


# --------------------------------------------------------------------
# PAGE 4: ANALYTICS ENDPOINT
# --------------------------------------------------------------------

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    """
    Returns rich analytics metrics for Page 4:
    - Monthly spending distribution
    - Category breakdown
    - Daily spending trend (last 30 days)
    - Top 5 largest expenses
    - Financial KPI metrics (Average daily spend, Highest expense, Most active day)
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. Monthly spending for the last 12 months
        cursor.execute("""
            SELECT 
                DATE_FORMAT(expense_date, '%Y-%m') AS month_code,
                DATE_FORMAT(expense_date, '%b %Y') AS month_name,
                COALESCE(SUM(amount), 0) AS total_amount,
                COUNT(*) AS transaction_count,
                ROUND(AVG(amount), 2) AS avg_transaction
            FROM expenses
            WHERE expense_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
            GROUP BY month_code, month_name
            ORDER BY month_code ASC;
        """)
        monthly_data = [serialize_row(r) for r in cursor.fetchall()]

        # 2. Category spending distribution
        cursor.execute("""
            SELECT 
                category,
                COALESCE(SUM(amount), 0) AS total_amount,
                COUNT(*) AS count,
                ROUND(AVG(amount), 2) AS avg_amount,
                MAX(amount) AS max_amount
            FROM expenses
            GROUP BY category
            ORDER BY total_amount DESC;
        """)
        category_data = [serialize_row(r) for r in cursor.fetchall()]

        # 3. Daily spending trend (Last 30 days)
        cursor.execute("""
            SELECT 
                expense_date,
                COALESCE(SUM(amount), 0) AS daily_amount,
                COUNT(*) AS transaction_count
            FROM expenses
            WHERE expense_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
            GROUP BY expense_date
            ORDER BY expense_date ASC;
        """)
        daily_trend = [serialize_row(r) for r in cursor.fetchall()]

        # 4. Top 5 highest single expense transactions
        cursor.execute("""
            SELECT expense_id, expense_date, category, description, amount
            FROM expenses
            ORDER BY amount DESC
            LIMIT 5;
        """)
        top_expenses = [serialize_row(r) for r in cursor.fetchall()]

        # 5. Key Financial KPIs
        cursor.execute("""
            SELECT 
                COALESCE(SUM(amount), 0) AS total_spent,
                COUNT(*) AS total_count,
                COALESCE(ROUND(AVG(amount), 2), 0) AS average_spend,
                COALESCE(MAX(amount), 0) AS max_single_expense,
                COALESCE(MIN(amount), 0) AS min_single_expense
            FROM expenses;
        """)
        kpi = cursor.fetchone() or {}

        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'kpis': serialize_row(kpi),
            'monthly_spending': monthly_data,
            'category_spending': category_data,
            'daily_trend': daily_trend,
            'top_expenses': top_expenses
        })

    except Error as e:
        return jsonify({'success': False, 'error': f"Failed to generate analytics: {e.msg}"}), 500


# --------------------------------------------------------------------
# PAGE 5: BUDGET TRACKER ENDPOINTS
# --------------------------------------------------------------------

@app.route('/api/budgets', methods=['GET'])
def get_budgets():
    """
    Fetch all category budgets and compute live current-month spending & progress bar utilization.
    Returns:
      - Category name
      - Monthly limit
      - Current month spend
      - Remaining balance
      - Percentage used
      - Status ('safe', 'warning', 'danger', 'exceeded')
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Ensure table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                budget_id INT AUTO_INCREMENT PRIMARY KEY,
                category VARCHAR(50) NOT NULL UNIQUE,
                monthly_limit DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        """)

        # Fetch budgets joined with current month's actual expenses
        query = """
            SELECT 
                b.budget_id,
                b.category,
                b.monthly_limit,
                COALESCE(SUM(e.amount), 0) AS spent_amount
            FROM budgets b
            LEFT JOIN expenses e 
                ON b.category = e.category 
               AND YEAR(e.expense_date) = YEAR(CURRENT_DATE())
               AND MONTH(e.expense_date) = MONTH(CURRENT_DATE())
            GROUP BY b.budget_id, b.category, b.monthly_limit
            ORDER BY b.monthly_limit DESC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()

        # Also get all distinct categories from expenses so the user can easily choose
        cursor.execute("SELECT DISTINCT category FROM expenses ORDER BY category ASC;")
        cat_rows = cursor.fetchall()
        existing_categories = [r['category'] for r in cat_rows]

        cursor.close()
        conn.close()

        budgets = []
        total_budgeted = 0.0
        total_spent = 0.0

        for r in rows:
            limit = float(r['monthly_limit'])
            spent = float(r['spent_amount'])
            remaining = max(0.0, limit - spent)
            pct = round((spent / limit) * 100, 1) if limit > 0 else 0.0

            total_budgeted += limit
            total_spent += spent

            # Utilization status
            if pct > 100:
                status = 'exceeded'
            elif pct >= 85:
                status = 'danger'
            elif pct >= 65:
                status = 'warning'
            else:
                status = 'safe'

            budgets.append({
                'budget_id': r['budget_id'],
                'category': r['category'],
                'monthly_limit': limit,
                'spent_amount': spent,
                'remaining_amount': remaining,
                'percentage': pct,
                'status': status
            })

        overall_pct = round((total_spent / total_budgeted) * 100, 1) if total_budgeted > 0 else 0.0

        return jsonify({
            'success': True,
            'budgets': budgets,
            'summary': {
                'total_budgeted': total_budgeted,
                'total_spent': total_spent,
                'overall_remaining': max(0.0, total_budgeted - total_spent),
                'overall_percentage': overall_pct
            },
            'categories': existing_categories
        })

    except Error as e:
        return jsonify({'success': False, 'error': f"Failed to load budget data: {e.msg}"}), 500


@app.route('/api/budgets', methods=['POST'])
def save_budget():
    """
    Set or update a monthly category budget.
    Payload:
      - category: string
      - monthly_limit: float > 0
    """
    try:
        data = request.get_json(force=True, silent=True) or request.form.to_dict()
        category = data.get('category', '').strip()
        monthly_limit_raw = data.get('monthly_limit')

        if not category:
            return jsonify({'success': False, 'error': 'Category is required.'}), 400

        try:
            monthly_limit = float(monthly_limit_raw)
            if monthly_limit <= 0:
                return jsonify({'success': False, 'error': 'Monthly limit must be greater than zero.'}), 400
        except (TypeError, ValueError):
            return jsonify({'success': False, 'error': 'Valid numeric budget limit is required.'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Insert or Update on Duplicate Key
        query = """
            INSERT INTO budgets (category, monthly_limit)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE monthly_limit = VALUES(monthly_limit);
        """
        cursor.execute(query, (category, monthly_limit))
        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'message': f"Monthly budget for '{category}' set to {CURRENCY_SYMBOL}{monthly_limit:,.2f}."
        })

    except Error as e:
        return jsonify({'success': False, 'error': f"Failed to save budget in MySQL: {e.msg}"}), 500


@app.route('/api/budgets/<int:budget_id>', methods=['DELETE'])
def delete_budget(budget_id):
    """Delete a category budget."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM budgets WHERE budget_id = %s;", (budget_id,))
        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'message': 'Category budget removed successfully.'
        })

    except Error as e:
        return jsonify({'success': False, 'error': f"Failed to delete budget: {e.msg}"}), 500


# --------------------------------------------------------------------
# CSV EXPORT FEATURE
# --------------------------------------------------------------------

@app.route('/api/export/csv', methods=['GET'])
def export_csv():
    """Export filtered expenses as a downloadable CSV spreadsheet."""
    try:
        category = request.args.get('category', '').strip()
        search = request.args.get('search', '').strip()
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()

        query = "SELECT expense_id, expense_date, category, description, amount FROM expenses WHERE 1=1"
        params = []

        if category and category.lower() != 'all':
            query += " AND category = %s"
            params.append(category)
        if search:
            query += " AND (description LIKE %s OR category LIKE %s)"
            s = f"%{search}%"
            params.extend([s, s])
        if start_date:
            query += " AND expense_date >= %s"
            params.append(start_date)
        if end_date:
            query += " AND expense_date <= %s"
            params.append(end_date)

        query += " ORDER BY expense_date DESC, expense_id DESC"

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        # Generate CSV in-memory
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Expense ID', 'Date', 'Category', 'Description', f'Amount ({CURRENCY_SYMBOL})'])

        for row in rows:
            date_str = row['expense_date'].strftime('%Y-%m-%d') if isinstance(row['expense_date'], (date, datetime)) else str(row['expense_date'])
            writer.writerow([
                row['expense_id'],
                date_str,
                row['category'],
                row['description'] or '',
                f"{float(row['amount']):.2f}"
            ])

        output.seek(0)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"expense_tracker_export_{timestamp}.csv"

        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename={filename}"}
        )

    except Error as e:
        return jsonify({'success': False, 'error': f"Failed to export CSV: {e.msg}"}), 500


# --------------------------------------------------------------------
# APPLICATION ENTRYPOINT
# --------------------------------------------------------------------

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug_mode = os.getenv('FLASK_DEBUG', '1') == '1'
    print("\n" + "=" * 65)
    print("  🚀 PERSONAL EXPENSE TRACKER WEBSITE (Flask + MySQL)")
    print(f"  👉 Server Running at: http://127.0.0.1:{port}")
    print(f"  👉 MySQL Host:        {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print(f"  👉 Database:          {DB_CONFIG['database']}")
    print(f"  👉 User:              {DB_CONFIG['user']}")
    print("=" * 65 + "\n")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
