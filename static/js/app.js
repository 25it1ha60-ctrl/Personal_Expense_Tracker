/**
 * ====================================================================
 * Personal Expense Tracker - Main Frontend Application Logic
 * ====================================================================
 * B.Tech Information Technology Project
 * Handles navigation, state, CRUD API operations, modals, filters,
 * real-time MySQL synchronization, and notifications.
 * ====================================================================
 */

// Global State
const state = {
    activeTab: 'dashboard',
    expenses: [],
    budgets: [],
    filters: {
        search: '',
        category: 'All',
        startDate: '',
        endDate: '',
        sortBy: 'date_desc'
    },
    deletingExpenseId: null,
    searchDebounceTimer: null
};

// Category Icon & Styling Mapping
const CATEGORY_META = {
    'Food & Dining': { icon: 'fa-utensils', badgeClass: 'badge-food' },
    'Transportation': { icon: 'fa-car', badgeClass: 'badge-transport' },
    'Shopping': { icon: 'fa-bag-shopping', badgeClass: 'badge-shopping' },
    'Bills & Utilities': { icon: 'fa-bolt', badgeClass: 'badge-bills' },
    'Entertainment': { icon: 'fa-film', badgeClass: 'badge-entertainment' },
    'Healthcare': { icon: 'fa-notes-medical', badgeClass: 'badge-healthcare' },
    'Education': { icon: 'fa-graduation-cap', badgeClass: 'badge-education' },
    'Travel': { icon: 'fa-plane', badgeClass: 'badge-travel' },
    'Groceries': { icon: 'fa-cart-shopping', badgeClass: 'badge-food' },
    'Investment & Savings': { icon: 'fa-chart-line', badgeClass: 'badge-healthcare' },
    'Personal Care': { icon: 'fa-spa', badgeClass: 'badge-shopping' },
    'Miscellaneous': { icon: 'fa-box', badgeClass: 'badge-default' }
};

// ====================================================================
// INITIALIZATION
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initLiveDate();
    initNavigation();
    initDefaultDates();
    checkHealth();

    // Determine initial view from URL hash or server-rendered active tab
    const urlHash = window.location.hash.replace('#', '');
    const initialTab = urlHash || (window.APP_CONFIG && window.APP_CONFIG.activeTab) || 'dashboard';
    switchTab(initialTab);

    // Event listener for hash changes
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '');
        if (hash && hash !== state.activeTab) {
            switchTab(hash);
        }
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
});

/**
 * Initializes and updates the header live date
 */
function initLiveDate() {
    const el = document.getElementById('liveDateDisplay');
    if (!el) return;
    const now = new Date();
    const options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
    el.textContent = now.toLocaleDateString('en-US', options);
}

/**
 * Sets today's date in form date pickers
 */
function initDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const addDateInput = document.getElementById('expenseDate');
    if (addDateInput && !addDateInput.value) {
        addDateInput.value = today;
    }
}

// ====================================================================
// THEME & NAVIGATION
// ====================================================================

function initTheme() {
    const savedTheme = localStorage.getItem('expense_tracker_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('expense_tracker_theme', next);
            updateThemeIcon(next);

            // Re-render charts with updated theme colors
            if (state.activeTab === 'dashboard') loadDashboardData();
            if (state.activeTab === 'analytics') loadAnalyticsData();
        });
    }
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    if (theme === 'light') {
        icon.className = 'fa-solid fa-sun';
        icon.style.color = '#f59e0b';
    } else {
        icon.className = 'fa-solid fa-moon';
        icon.style.color = '#94a3b8';
    }
}

function initNavigation() {
    // Nav link clicks
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Mobile sidebar controls
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('openSidebarBtn');
    const closeBtn = document.getElementById('closeSidebarBtn');

    if (openBtn) {
        openBtn.addEventListener('click', () => sidebar.classList.add('mobile-open'));
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => sidebar.classList.remove('mobile-open'));
    }
}

/**
 * Main tab switcher for all 5 views
 */
function switchTab(tabName) {
    const validTabs = ['dashboard', 'add-expense', 'history', 'analytics', 'budgets'];
    if (!validTabs.includes(tabName)) tabName = 'dashboard';

    state.activeTab = tabName;
    window.location.hash = tabName;

    // Update active class on nav links
    document.querySelectorAll('.nav-item').forEach(link => {
        if (link.getAttribute('data-tab') === tabName) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Update active section visibility
    document.querySelectorAll('.tab-view').forEach(view => {
        view.classList.remove('active');
    });
    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) targetView.classList.add('active');

    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');

    // Update Title & Subtitle
    updatePageHeaders(tabName);

    // Fetch tab data dynamically
    if (tabName === 'dashboard') {
        loadDashboardData();
    } else if (tabName === 'add-expense') {
        initDefaultDates();
    } else if (tabName === 'history') {
        loadExpenseHistory();
    } else if (tabName === 'analytics') {
        loadAnalyticsData();
    } else if (tabName === 'budgets') {
        loadBudgetData();
    }
}

function updatePageHeaders(tab) {
    const titleEl = document.getElementById('pageTitle');
    const subEl = document.getElementById('pageSubtitle');
    if (!titleEl || !subEl) return;

    const headers = {
        'dashboard': {
            title: 'Dashboard',
            subtitle: 'Real-time overview of your personal financial spending'
        },
        'add-expense': {
            title: 'Add New Expense',
            subtitle: 'Log a new transaction directly into your MySQL database'
        },
        'history': {
            title: 'Expense History',
            subtitle: 'Search, filter, edit, or export your complete transaction log'
        },
        'analytics': {
            title: 'Financial Analytics',
            subtitle: 'Interactive visualizations and deep spending insights'
        },
        'budgets': {
            title: 'Budget Tracker',
            subtitle: 'Set category thresholds and track monthly spending utilization'
        }
    };

    const header = headers[tab] || headers['dashboard'];
    titleEl.textContent = header.title;
    subEl.textContent = header.subtitle;
}

// ====================================================================
// HEALTH & MYSQL CONNECTION STATUS
// ====================================================================

async function checkHealth() {
    const chipDot = document.getElementById('dbStatusDot');
    const chipText = document.getElementById('dbStatusText');
    const alertBanner = document.getElementById('dbAlertBanner');
    const alertMsg = document.getElementById('dbAlertMessage');

    try {
        const response = await fetch('/api/health');
        const data = await response.json();

        if (data.database_connected) {
            chipDot.className = 'status-dot connected';
            chipText.textContent = `MySQL: ${data.database_name} (${data.table_info?.expenses_count || 0} rows)`;
            if (alertBanner) alertBanner.style.display = 'none';
        } else {
            chipDot.className = 'status-dot error';
            chipText.textContent = 'MySQL Disconnected';
            if (alertBanner) {
                alertBanner.style.display = 'flex';
                alertMsg.textContent = `${data.message}. Check your .env file and ensure MySQL is running.`;
            }
        }
    } catch (err) {
        chipDot.className = 'status-dot error';
        chipText.textContent = 'Backend Offline';
        if (alertBanner) {
            alertBanner.style.display = 'flex';
            alertMsg.textContent = 'Cannot connect to Flask server. Please run: python app.py';
        }
    }
}

// ====================================================================
// UTILITY HELPERS
// ====================================================================

function formatCurrency(amount) {
    const symbol = (window.APP_CONFIG && window.APP_CONFIG.currency) || '₹';
    const num = Number(amount || 0);
    return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

function getCategoryBadge(category) {
    const meta = CATEGORY_META[category] || { icon: 'fa-tag', badgeClass: 'badge-default' };
    return `
        <span class="category-badge ${meta.badgeClass}">
            <i class="fa-solid ${meta.icon}"></i> ${escapeHtml(category || 'Uncategorized')}
        </span>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';
    if (type === 'info') icon = 'fa-circle-info';

    toast.innerHTML = `
        <i class="fa-solid ${icon} toast-icon"></i>
        <div class="toast-msg">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ====================================================================
// PAGE 1: DASHBOARD LOGIC
// ====================================================================

async function loadDashboardData() {
    try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();

        if (!data.success) {
            showToast(data.error || 'Failed to load dashboard statistics', 'error');
            return;
        }

        const summary = data.summary;

        // KPI 1: Total Expenses
        const elTotal = document.getElementById('kpiTotalExpenses');
        if (elTotal) elTotal.textContent = formatCurrency(summary.total_expenses);

        // KPI 2: Current Month Expenses
        const elMonth = document.getElementById('kpiMonthExpenses');
        if (elMonth) elMonth.textContent = formatCurrency(summary.current_month_expenses);

        // KPI 3: Total Transactions
        const elTx = document.getElementById('kpiTotalTransactions');
        if (elTx) elTx.textContent = Number(summary.total_transactions).toLocaleString();

        // KPI 4: Highest Spending Category
        const elTopCat = document.getElementById('kpiHighestCategory');
        const elTopAmt = document.getElementById('kpiHighestCategoryAmount');
        if (elTopCat) elTopCat.textContent = summary.highest_category.category;
        if (elTopAmt) elTopAmt.textContent = formatCurrency(summary.highest_category.amount);

        // Render Page 1 Charts
        if (typeof renderDashboardCharts === 'function') {
            renderDashboardCharts(data.monthly_trend, data.category_breakdown);
        }

        // Render Recent Transactions Table
        renderDashboardRecentTable(data.recent_transactions);

    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
    }
}

function renderDashboardRecentTable(transactions) {
    const tbody = document.getElementById('dashboardRecentTableBody');
    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="table-loading">
                    <i class="fa-regular fa-folder-open" style="font-size: 1.5rem; display: block; margin-bottom: 0.5rem;"></i>
                    No expenses logged yet. Click "Add Expense" to record your first transaction!
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = transactions.map(item => `
        <tr>
            <td>${formatDate(item.expense_date)}</td>
            <td>${getCategoryBadge(item.category)}</td>
            <td>${escapeHtml(item.description || '-')}</td>
            <td class="text-right amount-cell">${formatCurrency(item.amount)}</td>
            <td class="text-center">
                <div class="action-btn-group">
                    <button class="btn-table-action" onclick="openEditModal(${item.expense_id})" title="Edit Expense">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-table-action delete-action" onclick="openDeleteModal(${item.expense_id}, '${escapeHtml(item.description)}', ${item.amount})" title="Delete Expense">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ====================================================================
// PAGE 2: ADD EXPENSE LOGIC
// ====================================================================

function selectQuickCategory(catName) {
    const select = document.getElementById('expenseCategory');
    if (select) {
        select.value = catName;
    }
}

function updateCharCounter(input) {
    const counter = document.getElementById('descCharCounter');
    if (counter) {
        counter.textContent = `${input.value.length} / 100`;
    }
}

async function handleExpenseSubmit(e) {
    e.preventDefault();

    const form = document.getElementById('addExpenseForm');
    const submitBtn = document.getElementById('saveExpenseBtn');

    const dateVal = document.getElementById('expenseDate').value;
    const catVal = document.getElementById('expenseCategory').value;
    const descVal = document.getElementById('expenseDescription').value.trim();
    const amountVal = document.getElementById('expenseAmount').value;

    if (!dateVal || !catVal || !amountVal) {
        showToast('Please fill all required fields.', 'error');
        return;
    }

    // Set loading state
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving to MySQL...';

    try {
        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                expense_date: dateVal,
                category: catVal,
                description: descVal,
                amount: parseFloat(amountVal)
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Expense recorded successfully in MySQL database!', 'success');
            form.reset();
            initDefaultDates();
            const counter = document.getElementById('descCharCounter');
            if (counter) counter.textContent = '0 / 100';

            // Refresh status chip count
            checkHealth();
        } else {
            showToast(result.error || 'Failed to save expense.', 'error');
        }
    } catch (err) {
        showToast('Network error while connecting to server.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
    }
}

// ====================================================================
// PAGE 3: EXPENSE HISTORY LOGIC
// ====================================================================

async function loadExpenseHistory() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="table-loading">
                <i class="fa-solid fa-spinner fa-spin"></i> Fetching records from MySQL...
            </td>
        </tr>
    `;

    try {
        const params = new URLSearchParams();
        if (state.filters.category && state.filters.category !== 'All') {
            params.append('category', state.filters.category);
        }
        if (state.filters.search) {
            params.append('search', state.filters.search);
        }
        if (state.filters.startDate) {
            params.append('start_date', state.filters.startDate);
        }
        if (state.filters.endDate) {
            params.append('end_date', state.filters.endDate);
        }
        if (state.filters.sortBy) {
            params.append('sort_by', state.filters.sortBy);
        }

        const res = await fetch(`/api/expenses?${params.toString()}`);
        const data = await res.json();

        if (!data.success) {
            showToast(data.error || 'Failed to fetch history', 'error');
            return;
        }

        state.expenses = data.expenses;
        renderHistoryTable(data.expenses);

    } catch (err) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="table-loading text-danger">
                    <i class="fa-solid fa-circle-exclamation"></i> Error loading expenses from MySQL.
                </td>
            </tr>
        `;
    }
}

function renderHistoryTable(expenses) {
    const tbody = document.getElementById('historyTableBody');
    const countEl = document.getElementById('historyRecordCount');
    const totalEl = document.getElementById('historyFilteredTotal');
    if (!tbody) return;

    if (!expenses || expenses.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="table-loading">
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 1.5rem; display: block; margin-bottom: 0.5rem;"></i>
                    No expense records found matching the current filters.
                </td>
            </tr>
        `;
        if (countEl) countEl.textContent = 'Showing 0 transactions';
        if (totalEl) totalEl.textContent = formatCurrency(0);
        return;
    }

    const totalSum = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    if (countEl) countEl.textContent = `Showing ${expenses.length} transaction${expenses.length === 1 ? '' : 's'}`;
    if (totalEl) totalEl.textContent = formatCurrency(totalSum);

    tbody.innerHTML = expenses.map(item => `
        <tr>
            <td style="color: var(--text-muted); font-weight: 500;">#${item.expense_id}</td>
            <td>${formatDate(item.expense_date)}</td>
            <td>${getCategoryBadge(item.category)}</td>
            <td>${escapeHtml(item.description || '-')}</td>
            <td class="text-right amount-cell">${formatCurrency(item.amount)}</td>
            <td class="text-center">
                <div class="action-btn-group">
                    <button class="btn-table-action" onclick="openEditModal(${item.expense_id})" title="Edit Expense #${item.expense_id}">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-table-action delete-action" onclick="openDeleteModal(${item.expense_id}, '${escapeHtml(item.description)}', ${item.amount})" title="Delete Expense #${item.expense_id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function applyFilters() {
    state.filters.category = document.getElementById('filterCategory').value;
    state.filters.startDate = document.getElementById('filterStartDate').value;
    state.filters.endDate = document.getElementById('filterEndDate').value;
    state.filters.sortBy = document.getElementById('filterSortBy').value;
    loadExpenseHistory();
}

function debounceFilter() {
    clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = setTimeout(() => {
        state.filters.search = document.getElementById('filterSearch').value.trim();
        loadExpenseHistory();
    }, 300);
}

function resetFilters() {
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterCategory').value = 'All';
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterSortBy').value = 'date_desc';

    state.filters = {
        search: '',
        category: 'All',
        startDate: '',
        endDate: '',
        sortBy: 'date_desc'
    };

    document.querySelectorAll('.preset-badge').forEach(b => b.classList.remove('active'));
    loadExpenseHistory();
}

function setDatePreset(preset) {
    const today = new Date();
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');

    document.querySelectorAll('.preset-badge').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    if (preset === 'all') {
        startInput.value = '';
        endInput.value = '';
    } else if (preset === 'this_month') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        startInput.value = firstDay;
        endInput.value = lastDay;
    } else if (preset === 'last_30') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        startInput.value = thirtyDaysAgo.toISOString().split('T')[0];
        endInput.value = today.toISOString().split('T')[0];
    } else if (preset === 'this_year') {
        const firstDay = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        const lastDay = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];
        startInput.value = firstDay;
        endInput.value = lastDay;
    }

    applyFilters();
}

function exportExpensesCSV() {
    const params = new URLSearchParams();
    if (state.filters.category && state.filters.category !== 'All') {
        params.append('category', state.filters.category);
    }
    if (state.filters.search) {
        params.append('search', state.filters.search);
    }
    if (state.filters.startDate) {
        params.append('start_date', state.filters.startDate);
    }
    if (state.filters.endDate) {
        params.append('end_date', state.filters.endDate);
    }

    window.location.href = `/api/export/csv?${params.toString()}`;
    showToast('Generating and downloading CSV spreadsheet...', 'info');
}

// ====================================================================
// PAGE 4: ANALYTICS LOGIC
// ====================================================================

async function loadAnalyticsData() {
    try {
        const res = await fetch('/api/analytics');
        const data = await res.json();

        if (!data.success) {
            showToast(data.error || 'Failed to load analytics', 'error');
            return;
        }

        const kpis = data.kpis || {};
        const elAvg = document.getElementById('analyticsAvgSpend');
        const elMax = document.getElementById('analyticsMaxExpense');
        const elMin = document.getElementById('analyticsMinExpense');

        if (elAvg) elAvg.textContent = formatCurrency(kpis.average_spend);
        if (elMax) elMax.textContent = formatCurrency(kpis.max_single_expense);
        if (elMin) elMin.textContent = formatCurrency(kpis.min_single_expense);

        // Render all 4 charts
        if (typeof renderAnalyticsCharts === 'function') {
            renderAnalyticsCharts(data);
        }

        // Render top 5 expenses table
        renderTopExpensesTable(data.top_expenses || []);

    } catch (err) {
        console.error('Analytics load error:', err);
    }
}

function renderTopExpensesTable(topExpenses) {
    const tbody = document.getElementById('analyticsTopExpensesTableBody');
    if (!tbody) return;

    if (!topExpenses.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="table-loading">No expense records available for ranking.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = topExpenses.map((item, index) => {
        let medal = '';
        if (index === 0) medal = '🥇 ';
        else if (index === 1) medal = '🥈 ';
        else if (index === 2) medal = '🥉 ';

        return `
            <tr>
                <td style="font-weight: 700; color: var(--text-primary);">${medal}#${index + 1}</td>
                <td>${formatDate(item.expense_date)}</td>
                <td>${getCategoryBadge(item.category)}</td>
                <td>${escapeHtml(item.description || '-')}</td>
                <td class="text-right amount-cell" style="color: var(--emerald);">${formatCurrency(item.amount)}</td>
            </tr>
        `;
    }).join('');
}

// ====================================================================
// PAGE 5: BUDGET TRACKER LOGIC
// ====================================================================

async function loadBudgetData() {
    const container = document.getElementById('budgetCardsContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="budget-empty-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <h3>Loading Category Budgets...</h3>
        </div>
    `;

    try {
        const res = await fetch('/api/budgets');
        const data = await res.json();

        if (!data.success) {
            showToast(data.error || 'Failed to load budgets', 'error');
            return;
        }

        const summary = data.summary || {};
        const elAlloc = document.getElementById('budgetTotalAllocated');
        const elSpent = document.getElementById('budgetTotalSpent');
        const elRem = document.getElementById('budgetTotalRemaining');

        if (elAlloc) elAlloc.textContent = formatCurrency(summary.total_budgeted);
        if (elSpent) elSpent.textContent = formatCurrency(summary.total_spent);
        if (elRem) elRem.textContent = formatCurrency(summary.overall_remaining);

        renderBudgetsList(data.budgets || []);

    } catch (err) {
        container.innerHTML = `
            <div class="budget-empty-state">
                <i class="fa-solid fa-triangle-exclamation text-danger"></i>
                <h3>Error Loading Budgets</h3>
                <p>Could not connect to MySQL server.</p>
            </div>
        `;
    }
}

function renderBudgetsList(budgets) {
    const container = document.getElementById('budgetCardsContainer');
    if (!container) return;

    if (!budgets.length) {
        container.innerHTML = `
            <div class="budget-empty-state">
                <i class="fa-solid fa-bullseye"></i>
                <h3>No Category Budgets Set Yet</h3>
                <p>Create a monthly spending limit for Food, Travel, Shopping or any category to stay financially disciplined.</p>
                <button class="btn btn-primary" onclick="openBudgetModal()">
                    <i class="fa-solid fa-plus"></i> Set Your First Budget
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = budgets.map(b => {
        const meta = CATEGORY_META[b.category] || { icon: 'fa-tags', badgeClass: 'badge-default' };
        
        let fillClass = 'fill-safe';
        let statusBadge = '<span class="badge badge-emerald">Within Budget</span>';

        if (b.status === 'warning') {
            fillClass = 'fill-warning';
            statusBadge = '<span class="badge badge-amber">Warning (65-85%)</span>';
        } else if (b.status === 'danger') {
            fillClass = 'fill-danger';
            statusBadge = '<span class="badge badge-rose">Near Limit (&gt;85%)</span>';
        } else if (b.status === 'exceeded') {
            fillClass = 'fill-exceeded';
            statusBadge = '<span class="badge badge-rose">Over Budget!</span>';
        }

        const barWidth = Math.min(100, Math.max(0, b.percentage));

        return `
            <div class="budget-item-card">
                <div class="budget-card-top">
                    <div class="b-cat-info">
                        <div class="b-cat-icon ${meta.badgeClass}">
                            <i class="fa-solid ${meta.icon}"></i>
                        </div>
                        <div class="b-cat-name">${escapeHtml(b.category)}</div>
                    </div>
                    <div>${statusBadge}</div>
                </div>

                <div class="budget-progress-container">
                    <div class="budget-progress-header">
                        <span class="spent-text">${formatCurrency(b.spent_amount)} spent</span>
                        <span class="limit-text">of ${formatCurrency(b.monthly_limit)}</span>
                    </div>
                    <div class="progress-track" title="${b.percentage}% utilized">
                        <div class="progress-fill ${fillClass}" style="width: ${barWidth}%;"></div>
                    </div>
                </div>

                <div class="budget-card-footer">
                    <div>
                        <span class="remaining-label">Remaining: </span>
                        <span class="remaining-value ${b.remaining_amount <= 0 ? 'text-danger' : 'text-emerald'}">
                            ${formatCurrency(b.remaining_amount)}
                        </span>
                    </div>
                    <div class="budget-card-actions">
                        <button class="btn-icon-budget" onclick="openBudgetModal('${escapeHtml(b.category)}', ${b.monthly_limit})" title="Edit Budget">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-icon-budget del" onclick="deleteBudget(${b.budget_id}, '${escapeHtml(b.category)}')" title="Delete Budget">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openBudgetModal(cat = '', limit = '') {
    const modal = document.getElementById('budgetModal');
    const title = document.getElementById('budgetModalTitle');
    const select = document.getElementById('budgetCategory');
    const input = document.getElementById('budgetMonthlyLimit');

    if (cat) {
        title.textContent = `Update Budget: ${cat}`;
        select.value = cat;
        input.value = limit;
    } else {
        title.textContent = 'Set Category Budget';
        select.value = '';
        input.value = '';
    }

    modal.classList.add('active');
}

function closeBudgetModal() {
    const modal = document.getElementById('budgetModal');
    if (modal) modal.classList.remove('active');
}

async function handleBudgetSubmit(e) {
    e.preventDefault();
    const cat = document.getElementById('budgetCategory').value;
    const limit = document.getElementById('budgetMonthlyLimit').value;
    const saveBtn = document.getElementById('saveBudgetBtn');

    if (!cat || !limit) {
        showToast('Please select category and enter monthly limit.', 'error');
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
        const res = await fetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: cat, monthly_limit: parseFloat(limit) })
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            closeBudgetModal();
            loadBudgetData();
        } else {
            showToast(data.error || 'Failed to save budget.', 'error');
        }
    } catch {
        showToast('Network error while saving budget.', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Budget';
    }
}

async function deleteBudget(budgetId, category) {
    if (!confirm(`Are you sure you want to remove the monthly budget for "${category}"?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/budgets/${budgetId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast(`Budget for ${category} removed.`, 'info');
            loadBudgetData();
        } else {
            showToast(data.error || 'Failed to delete budget.', 'error');
        }
    } catch {
        showToast('Failed to delete budget.', 'error');
    }
}

// ====================================================================
// MODAL CRUD ACTIONS (EDIT & DELETE EXPENSE)
// ====================================================================

async function openEditModal(expenseId) {
    try {
        const res = await fetch(`/api/expenses/${expenseId}`);
        const data = await res.json();

        if (!data.success) {
            showToast('Failed to load expense details', 'error');
            return;
        }

        const exp = data.expense;
        document.getElementById('editExpenseId').value = exp.expense_id;
        document.getElementById('editExpenseDate').value = exp.expense_date;
        document.getElementById('editExpenseCategory').value = exp.category;
        document.getElementById('editExpenseDescription').value = exp.description || '';
        document.getElementById('editExpenseAmount').value = exp.amount;

        document.getElementById('editExpenseModal').classList.add('active');
    } catch {
        showToast('Error loading expense data.', 'error');
    }
}

function closeEditModal() {
    const modal = document.getElementById('editExpenseModal');
    if (modal) modal.classList.remove('active');
}

async function handleExpenseUpdate(e) {
    e.preventDefault();

    const id = document.getElementById('editExpenseId').value;
    const dateVal = document.getElementById('editExpenseDate').value;
    const catVal = document.getElementById('editExpenseCategory').value;
    const descVal = document.getElementById('editExpenseDescription').value.trim();
    const amountVal = document.getElementById('editExpenseAmount').value;
    const btn = document.getElementById('updateExpenseBtn');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

    try {
        const res = await fetch(`/api/expenses/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                expense_date: dateVal,
                category: catVal,
                description: descVal,
                amount: parseFloat(amountVal)
            })
        });

        const result = await res.json();
        if (result.success) {
            showToast(`Expense #${id} successfully updated!`, 'success');
            closeEditModal();
            // Refresh current view
            if (state.activeTab === 'dashboard') loadDashboardData();
            if (state.activeTab === 'history') loadExpenseHistory();
            if (state.activeTab === 'analytics') loadAnalyticsData();
        } else {
            showToast(result.error || 'Failed to update expense.', 'error');
        }
    } catch {
        showToast('Error updating expense.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
    }
}

function openDeleteModal(expenseId, description, amount) {
    state.deletingExpenseId = expenseId;
    const detailsBox = document.getElementById('deleteDetailsBox');
    if (detailsBox) {
        detailsBox.innerHTML = `
            <strong>Expense ID:</strong> #${expenseId}<br>
            <strong>Description:</strong> ${description || '(No description)'}<br>
            <strong>Amount:</strong> ${formatCurrency(amount)}
        `;
    }
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.add('active');
}

function closeDeleteModal() {
    state.deletingExpenseId = null;
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('active');
}

async function confirmDeleteExpense() {
    if (!state.deletingExpenseId) return;

    const id = state.deletingExpenseId;
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';

    try {
        const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
        const result = await res.json();

        if (result.success) {
            showToast(`Expense #${id} permanently deleted.`, 'info');
            closeDeleteModal();
            // Refresh current view
            if (state.activeTab === 'dashboard') loadDashboardData();
            if (state.activeTab === 'history') loadExpenseHistory();
            if (state.activeTab === 'analytics') loadAnalyticsData();
            if (state.activeTab === 'budgets') loadBudgetData();
            checkHealth();
        } else {
            showToast(result.error || 'Failed to delete expense.', 'error');
        }
    } catch {
        showToast('Error connecting to server to delete expense.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete Expense';
    }
}

function closeAllModals() {
    closeEditModal();
    closeDeleteModal();
    closeBudgetModal();
}
