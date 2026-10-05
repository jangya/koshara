import type {DateRange} from '@astryxdesign/core/DateRangeInput';
import {buildDashboardViewModel} from './dashboard-insights';
import type {KosharaState} from './koshara-types';

// Legacy financial display components may still use these facts; dashboard composition
// is now stored as DashboardDefinition and is never selected by household state.
export type DashboardModule = 'CASHFLOW' | 'SPENDING_BY_CATEGORY' | 'BUDGET_PROGRESS' | 'SAVINGS_OUTLOOK' | 'UPCOMING_BILLS' | 'ACCOUNTS' | 'RECENT_TRANSACTIONS';
export interface DashboardFocusMetric {label: string; value: string; description: string}

export interface HouseholdFinancialState {
  period: DateRange;
  incomeMinor: number;
  spendingMinor: number;
  previousSpendingMinor: number;
  spendingChangePercent: number | null;
  netCashFlowMinor: number;
  savingsRatePercent: number | null;
  topCategories: Array<{name: string; amountMinor: number}>;
  overBudgetCount: number;
  nearLimitCount: number;
  needsReviewCount: number;
  upcomingBillsCount: number;
  upcomingBillsAmountMinor: number;
}

export function upcomingBills(state: KosharaState, today: string) {
  const start = new Date(`${today}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  return (state.bills ?? []).filter((bill) => bill.dueDate >= today && bill.dueDate <= endDate)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

export function buildHouseholdFinancialState(state: KosharaState, range: DateRange): HouseholdFinancialState {
  const view = buildDashboardViewModel(state, range);
  const bills = upcomingBills(state, range.end);
  return {
    period: range,
    incomeMinor: view.currentSummary.incomeMinor,
    spendingMinor: view.currentSummary.spendingMinor,
    previousSpendingMinor: view.previousSummary.spendingMinor,
    spendingChangePercent: view.metrics[0]!.comparison.percent,
    netCashFlowMinor: view.currentSummary.netCashFlowMinor,
    savingsRatePercent: view.currentSummary.incomeMinor > 0
      ? Math.round(view.currentSummary.netCashFlowMinor / view.currentSummary.incomeMinor * 100) : null,
    topCategories: view.categories.slice(0, 3).map((row) => ({name: row.category.name, amountMinor: row.spendingMinor})),
    overBudgetCount: view.budgetAttention.filter(({reason}) => reason === 'Over budget').length,
    nearLimitCount: view.budgetAttention.filter(({reason}) => reason === 'Near limit').length,
    needsReviewCount: view.currentSummary.needsReviewCount,
    upcomingBillsCount: bills.length,
    upcomingBillsAmountMinor: bills.reduce((sum, bill) => sum + bill.amountMinor, 0),
  };
}

export function dashboardFocusMetrics(financial: HouseholdFinancialState, hero: DashboardModule): DashboardFocusMetric[] {
  const currency = (minor: number) => new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0}).format(minor / 100);
  switch (hero) {
    case 'BUDGET_PROGRESS': return [
      {label: 'Over budget', value: String(financial.overBudgetCount), description: 'Categories past their limits'},
      {label: 'Near limit', value: String(financial.nearLimitCount), description: 'Categories close to their limits'},
    ];
    case 'SAVINGS_OUTLOOK': return [
      {label: 'Cash flow margin', value: currency(financial.netCashFlowMinor), description: 'Income less recorded outflows'},
      {label: 'Margin of income', value: financial.savingsRatePercent === null ? '—' : `${financial.savingsRatePercent}%`, description: 'Available after recorded outflows'},
    ];
    case 'UPCOMING_BILLS': return [
      {label: 'Bills due soon', value: String(financial.upcomingBillsCount), description: 'Scheduled within 30 days'},
      {label: 'Amount due', value: currency(financial.upcomingBillsAmountMinor), description: 'Total upcoming bills'},
    ];
    case 'RECENT_TRANSACTIONS': return [
      {label: 'Needs review', value: String(financial.needsReviewCount), description: 'Transactions awaiting confirmation'},
      {label: 'Upcoming bills', value: String(financial.upcomingBillsCount), description: 'Scheduled within 30 days'},
    ];
    case 'SPENDING_BY_CATEGORY': return [
      {label: 'Top category', value: financial.topCategories[0]?.name ?? '—', description: 'Largest recorded spending category'},
      {label: 'Top category spend', value: currency(financial.topCategories[0]?.amountMinor ?? 0), description: 'Current period'},
    ];
    case 'ACCOUNTS':
    case 'CASHFLOW': return [
      {label: 'Income', value: currency(financial.incomeMinor), description: 'Current period'},
      {label: 'Spending', value: currency(financial.spendingMinor), description: 'Current period'},
    ];
  }
}

