/**
 * ====================================================================
 * Personal Expense Tracker - Chart.js Visualizations
 * ====================================================================
 * Handles rendering, updates, and themes for all interactive charts:
 * - Page 1: Dashboard Monthly Bar Chart & Category Doughnut Chart
 * - Page 4: Analytics Monthly, Category, Daily Trend, & Ranked Bars
 * ====================================================================
 */

// Color Palettes
const CHART_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#3b82f6', // Blue
    '#f43f5e', // Rose
    '#14b8a6', // Teal
    '#eab308', // Yellow
    '#64748b'  // Slate
];

// Global Chart Instances
let dashboardMonthlyChartInstance = null;
let dashboardCategoryChartInstance = null;
let analyticsMonthlyChartInstance = null;
let analyticsCategoryChartInstance = null;
let analyticsDailyChartInstance = null;
let analyticsRankedChartInstance = null;

/**
 * Returns Chart.js grid and label styling based on current theme (dark/light)
 */
function getChartThemeOptions() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
        textColor: isDark ? '#94a3b8' : '#475569',
        gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
        tooltipBg: isDark ? '#1e293b' : '#ffffff',
        tooltipText: isDark ? '#f8fafc' : '#0f172a',
        tooltipBorder: isDark ? '#334155' : '#cbd5e1'
    };
}

/**
 * Formats a numeric value with the application currency symbol
 */
function formatChartCurrency(val) {
    const symbol = (window.APP_CONFIG && window.APP_CONFIG.currency) || '₹';
    return `${symbol}${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ====================================================================
// PAGE 1: DASHBOARD CHARTS
// ====================================================================

/**
 * Renders or updates both charts on Page 1 (Dashboard)
 */
function renderDashboardCharts(monthlyTrend, categoryBreakdown) {
    renderDashboardMonthlyChart(monthlyTrend);
    renderDashboardCategoryChart(categoryBreakdown);
}

/**
 * 1. Monthly Spending Bar Chart
 */
function renderDashboardMonthlyChart(monthlyData) {
    const canvas = document.getElementById('dashboardMonthlyChart');
    if (!canvas) return;

    if (dashboardMonthlyChartInstance) {
        dashboardMonthlyChartInstance.destroy();
    }

    const theme = getChartThemeOptions();
    const ctx = canvas.getContext('2d');

    const labels = (monthlyData || []).map(item => item.month_label);
    const dataValues = (monthlyData || []).map(item => item.total_amount);

    // Create subtle gradient
    let gradient = null;
    if (ctx) {
        gradient = ctx.createLinearGradient(0, 0, 0, 280);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.85)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.2)');
    }

    dashboardMonthlyChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                label: 'Monthly Spending',
                data: dataValues.length ? dataValues : [0],
                backgroundColor: gradient || '#6366f1',
                borderRadius: 8,
                borderSkipped: false,
                maxBarThickness: 46
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    titleColor: theme.tooltipText,
                    bodyColor: theme.tooltipText,
                    borderColor: theme.tooltipBorder,
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context) {
                            return ` Spent: ${formatChartCurrency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: theme.textColor, font: { family: 'Inter', size: 12 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: theme.gridColor },
                    ticks: {
                        color: theme.textColor,
                        font: { family: 'Inter', size: 11 },
                        callback: function (val) {
                            return (window.APP_CONFIG?.currency || '₹') + Number(val).toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

/**
 * 2. Category-wise Spending Doughnut Chart
 */
function renderDashboardCategoryChart(categoryData) {
    const canvas = document.getElementById('dashboardCategoryChart');
    if (!canvas) return;

    if (dashboardCategoryChartInstance) {
        dashboardCategoryChartInstance.destroy();
    }

    const theme = getChartThemeOptions();
    const categories = (categoryData || []).slice(0, 7); // Show top 7 in doughnut
    const labels = categories.map(c => c.category);
    const dataValues = categories.map(c => c.total_amount);
    const bgColors = CHART_COLORS.slice(0, Math.max(categories.length, 1));

    dashboardCategoryChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['No Expenses Yet'],
            datasets: [{
                data: dataValues.length ? dataValues : [1],
                backgroundColor: bgColors,
                borderWidth: 2,
                borderColor: theme.tooltipBg,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: theme.textColor,
                        font: { family: 'Inter', size: 11 },
                        padding: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    titleColor: theme.tooltipText,
                    bodyColor: theme.tooltipText,
                    borderColor: theme.tooltipBorder,
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context) {
                            if (!dataValues.length) return ' No transactions recorded.';
                            const total = dataValues.reduce((a, b) => a + b, 0);
                            const val = context.raw || 0;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return ` ${context.label}: ${formatChartCurrency(val)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// ====================================================================
// PAGE 4: ANALYTICS CHARTS
// ====================================================================

/**
 * Renders all 4 interactive visualizations for Page 4
 */
function renderAnalyticsCharts(analyticsData) {
    const theme = getChartThemeOptions();

    // 1. Monthly Spending Trend
    renderAnalyticsMonthly(analyticsData.monthly_spending || [], theme);

    // 2. Category Breakdown Doughnut
    renderAnalyticsCategory(analyticsData.category_spending || [], theme);

    // 3. Daily Spending Trend (Last 30 Days)
    renderAnalyticsDaily(analyticsData.daily_trend || [], theme);

    // 4. Ranked Categories Bar Chart
    renderAnalyticsRanked(analyticsData.category_spending || [], theme);
}

function renderAnalyticsMonthly(monthlyData, theme) {
    const canvas = document.getElementById('analyticsMonthlyChart');
    if (!canvas) return;

    if (analyticsMonthlyChartInstance) {
        analyticsMonthlyChartInstance.destroy();
    }

    const labels = monthlyData.map(m => m.month_name);
    const totals = monthlyData.map(m => m.total_amount);
    const counts = monthlyData.map(m => m.transaction_count);

    analyticsMonthlyChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [
                {
                    type: 'bar',
                    label: 'Total Spending',
                    data: totals.length ? totals : [0],
                    backgroundColor: 'rgba(99, 102, 241, 0.75)',
                    borderRadius: 6,
                    yAxisID: 'y',
                    maxBarThickness: 38
                },
                {
                    type: 'line',
                    label: 'Transactions Count',
                    data: counts.length ? counts : [0],
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    borderWidth: 2,
                    tension: 0.35,
                    yAxisID: 'y1',
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: theme.textColor, font: { family: 'Inter', size: 11 }, usePointStyle: true }
                },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    titleColor: theme.tooltipText,
                    bodyColor: theme.tooltipText,
                    borderColor: theme.tooltipBorder,
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function (ctx) {
                            if (ctx.dataset.type === 'line') {
                                return ` Transactions: ${ctx.raw}`;
                            }
                            return ` Spent: ${formatChartCurrency(ctx.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: theme.textColor, font: { size: 11 } }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    grid: { color: theme.gridColor },
                    ticks: {
                        color: theme.textColor,
                        callback: val => (window.APP_CONFIG?.currency || '₹') + Number(val).toLocaleString()
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { color: '#10b981', stepSize: 1 }
                }
            }
        }
    });
}

function renderAnalyticsCategory(categoryData, theme) {
    const canvas = document.getElementById('analyticsCategoryChart');
    if (!canvas) return;

    if (analyticsCategoryChartInstance) {
        analyticsCategoryChartInstance.destroy();
    }

    const labels = categoryData.map(c => c.category);
    const values = categoryData.map(c => c.total_amount);

    analyticsCategoryChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                data: values.length ? values : [1],
                backgroundColor: CHART_COLORS.slice(0, Math.max(labels.length, 1)),
                borderWidth: 2,
                borderColor: theme.tooltipBg
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: theme.textColor, font: { family: 'Inter', size: 11 }, padding: 10, usePointStyle: true }
                },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    titleColor: theme.tooltipText,
                    bodyColor: theme.tooltipText,
                    borderColor: theme.tooltipBorder,
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function (ctx) {
                            const total = values.reduce((a, b) => a + b, 0);
                            const val = ctx.raw || 0;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return ` ${ctx.label}: ${formatChartCurrency(val)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderAnalyticsDaily(dailyData, theme) {
    const canvas = document.getElementById('analyticsDailyChart');
    if (!canvas) return;

    if (analyticsDailyChartInstance) {
        analyticsDailyChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    let gradient = null;
    if (ctx) {
        gradient = ctx.createLinearGradient(0, 0, 0, 240);
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
        gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
    }

    const labels = dailyData.map(d => d.expense_date);
    const amounts = dailyData.map(d => d.daily_amount);

    analyticsDailyChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['No Recent Days'],
            datasets: [{
                label: 'Daily Expenditure',
                data: amounts.length ? amounts : [0],
                borderColor: '#06b6d4',
                backgroundColor: gradient || 'rgba(6, 182, 212, 0.1)',
                borderWidth: 2.5,
                tension: 0.35,
                fill: true,
                pointBackgroundColor: '#06b6d4',
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    titleColor: theme.tooltipText,
                    bodyColor: theme.tooltipText,
                    borderColor: theme.tooltipBorder,
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: ctx => ` Total: ${formatChartCurrency(ctx.raw)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: theme.textColor, font: { size: 10 }, maxRotation: 45 }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: theme.gridColor },
                    ticks: {
                        color: theme.textColor,
                        callback: val => (window.APP_CONFIG?.currency || '₹') + Number(val).toLocaleString()
                    }
                }
            }
        }
    });
}

function renderAnalyticsRanked(categoryData, theme) {
    const canvas = document.getElementById('analyticsRankedBarChart');
    if (!canvas) return;

    if (analyticsRankedChartInstance) {
        analyticsRankedChartInstance.destroy();
    }

    const sorted = [...categoryData].sort((a, b) => b.total_amount - a.total_amount).slice(0, 7);
    const labels = sorted.map(c => c.category);
    const values = sorted.map(c => c.total_amount);

    analyticsRankedChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                label: 'Total Spent',
                data: values.length ? values : [0],
                backgroundColor: CHART_COLORS.slice(0, Math.max(labels.length, 1)),
                borderRadius: 6,
                maxBarThickness: 24
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    titleColor: theme.tooltipText,
                    bodyColor: theme.tooltipText,
                    borderColor: theme.tooltipBorder,
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: ctx => ` Spent: ${formatChartCurrency(ctx.raw)}`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: theme.gridColor },
                    ticks: {
                        color: theme.textColor,
                        callback: val => (window.APP_CONFIG?.currency || '₹') + Number(val).toLocaleString()
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: theme.textColor, font: { size: 11 } }
                }
            }
        }
    });
}
