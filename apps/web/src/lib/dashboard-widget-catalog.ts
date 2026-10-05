export const dashboardWidgetCatalog = {
  cashflow: {title: 'Cash flow', kind: 'visual', defaultSpan: 8},
  category_spending: {title: 'Spending by category', kind: 'visual', defaultSpan: 6},
  recent_transactions: {title: 'Recent transactions', kind: 'visual', defaultSpan: 12},
  income: {title: 'Monthly income', kind: 'metric', defaultSpan: 6},
  spending: {title: 'Monthly spending', kind: 'metric', defaultSpan: 6},
  accounts: {title: 'Accounts', kind: 'visual', defaultSpan: 6},
  budget: {title: 'Budget', kind: 'visual', defaultSpan: 6},
} as const;
export type DashboardWidgetType = keyof typeof dashboardWidgetCatalog;
