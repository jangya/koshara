import type {DateRange} from '@astryxdesign/core/DateRangeInput';
import type {ComponentType} from 'react';

import {DashboardCategorySpending} from '@/components/dashboard-category-spending';
import {DashboardAccounts} from '@/components/dashboard-accounts';
import {DashboardBudgetAttention} from '@/components/dashboard-budget-attention';
import {DashboardRecentTransactions} from '@/components/dashboard-recent-transactions';
import {DashboardSummaryCard} from '@/components/dashboard-summary-card';
import {IncomeSpendingChart} from '@/components/income-spending-chart';
import type {buildDashboardViewModel} from '@/lib/dashboard-insights';
import type {KosharaState} from '@/lib/koshara-types';
import {filterAndSortTransactions} from '@/lib/transaction-view';
import {formatDateRange} from '@/lib/date-range';
import type {DashboardWidgetConfig} from '@/lib/dashboard-definition';
import {dashboardWidgetCatalog, type DashboardWidgetType} from '@/lib/dashboard-widget-catalog';
export type {DashboardWidgetType} from '@/lib/dashboard-widget-catalog';

type DashboardViewModel = ReturnType<typeof buildDashboardViewModel>;

export type WorkspaceWidgetType = 'cashflow' | 'category_spending' | 'recent_transactions' | 'income' | 'spending';

export interface WorkspaceWidgetProps {
  state: KosharaState;
  range: DateRange;
  view: DashboardViewModel;
  period: string;
  previousPeriod: string;
  config?: DashboardWidgetConfig;
}

function CashflowWidget({state, range}: WorkspaceWidgetProps) {
  return <IncomeSpendingChart state={state} range={range} disableAnimation />;
}

function CategorySpendingWidget({state, range}: WorkspaceWidgetProps) {
  return <DashboardCategorySpending state={state} range={range} preset="custom" disableAnimation showNavigationLink={false} />;
}

function RecentTransactionsWidget({state, view, period, range, config}: WorkspaceWidgetProps) {
  const transactions = filterAndSortTransactions(config?.categoryIds ? state.transactions.filter(({categoryId}) => config.categoryIds?.includes(categoryId)) : state.transactions, {
    range: config?.dateRange ?? range, query: config?.search ?? '', accountId: config?.accountId ?? 'all',
    categoryId: config?.categoryId ?? 'all', kind: config?.transactionType ?? 'all', reviewStatus: 'all',
    sortBy: config?.sort?.startsWith('amount') ? 'amount' : 'date',
    sortDirection: config?.sort === 'amount_asc' ? 'ascending' : 'descending',
  }).slice(0, 7);
  const byId = new Map(view.recentTransactions.map((row) => [row.transaction.id, row]));
  const accountNames = new Map(state.accounts.map((account) => [account.id, account.name]));
  const categoryNames = new Map(state.categories.map((category) => [category.id, category.name]));
  const rows = transactions.map((transaction) => byId.get(transaction.id) ?? {
    transaction, accountName: accountNames.get(transaction.accountId) ?? 'Unknown account',
    categoryName: categoryNames.get(transaction.categoryId) ?? 'Uncategorized',
  });
  return <DashboardRecentTransactions rows={rows} period={config?.dateRange ? formatDateRange(config.dateRange) : period} allTransactionsHref="/transactions" showNavigationLink={false} />;
}

function IncomeWidget({view, previousPeriod}: WorkspaceWidgetProps) {
  return <DashboardSummaryCard metric={view.metrics.find(({key}) => key === 'income')!} previousPeriod={previousPeriod} disableAnimation />;
}

function SpendingWidget({view, previousPeriod}: WorkspaceWidgetProps) {
  return <DashboardSummaryCard metric={view.metrics.find(({key}) => key === 'spending')!} previousPeriod={previousPeriod} disableAnimation />;
}

function AccountsWidget({view}: WorkspaceWidgetProps) { return <DashboardAccounts accounts={view.accounts} />; }
function BudgetWidget({view, period}: WorkspaceWidgetProps) { return <DashboardBudgetAttention items={view.budgetAttention} period={period} />; }

// Widget IDs resolve to existing Kosara components; requests never supply JSX.
const components: Record<DashboardWidgetType, ComponentType<WorkspaceWidgetProps>> = {
  cashflow: CashflowWidget, category_spending: CategorySpendingWidget,
  recent_transactions: RecentTransactionsWidget, income: IncomeWidget,
  spending: SpendingWidget, accounts: AccountsWidget, budget: BudgetWidget,
};
export const dashboardWidgetRegistry = Object.fromEntries(
  (Object.keys(dashboardWidgetCatalog) as DashboardWidgetType[]).map((type) => [type, {...dashboardWidgetCatalog[type], component: components[type]}]),
) as Record<DashboardWidgetType, {title: string; kind: 'metric' | 'visual'; defaultSpan: number; component: ComponentType<WorkspaceWidgetProps>}>;
export const workspaceWidgetRegistry = dashboardWidgetRegistry;
