import type {DateRange} from '@astryxdesign/core/DateRangeInput';

import {buildCategoryAnalytics, type CategoryAnalyticsRow} from './category-analytics';
import {aggregateTimeline, getPreviousPeriod, isInDateRange} from './date-range';
import {compareMetric, summarizeTransactions, type MetricComparison} from './finance-insights';
import type {Account, KosharaState, Transaction} from './koshara-types';

export interface DashboardMetric {
  key: 'spending' | 'income' | 'net' | 'transactions';
  label: string;
  value: number;
  comparison: MetricComparison;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface DashboardBudgetAttention {
  row: CategoryAnalyticsRow;
  reason: 'Over budget' | 'Near limit' | 'Unusual increase';
}

export interface DashboardRecentTransaction {
  transaction: Transaction;
  accountName: string;
  categoryName: string;
}

const unusualIncreasePercent = 25;
const unusualIncreaseMinimumMinor = 100_000;

function comparisonSentiment(
  key: DashboardMetric['key'],
  comparison: MetricComparison,
): DashboardMetric['sentiment'] {
  if (comparison.direction === 'unchanged' || comparison.direction === 'new' || key === 'transactions') return 'neutral';
  const higherIsPositive = key === 'income' || key === 'net';
  return (comparison.direction === 'higher') === higherIsPositive ? 'positive' : 'negative';
}

function buildMetric(
  key: DashboardMetric['key'],
  label: string,
  value: number,
  previousValue: number,
): DashboardMetric {
  const comparison = compareMetric(value, previousValue);
  return {key, label, value, comparison, sentiment: comparisonSentiment(key, comparison)};
}

function attentionReason(row: CategoryAnalyticsRow): DashboardBudgetAttention['reason'] | null {
  if (row.budgetStatus?.label === 'Over budget') return 'Over budget';
  if (row.budgetStatus?.label === 'Near limit') return 'Near limit';
  const increaseMinor = row.spendingMinor - row.previousSpendingMinor;
  if (
    row.change.direction === 'higher'
    && (row.change.percent ?? 0) >= unusualIncreasePercent
    && increaseMinor >= unusualIncreaseMinimumMinor
  ) return 'Unusual increase';
  return null;
}

function attentionRank(reason: DashboardBudgetAttention['reason']) {
  if (reason === 'Over budget') return 0;
  if (reason === 'Near limit') return 1;
  return 2;
}

export function buildDashboardViewModel(state: KosharaState, range: DateRange) {
  const previousRange = getPreviousPeriod(range);
  const currentSummary = summarizeTransactions(state.transactions, range);
  const previousSummary = summarizeTransactions(state.transactions, previousRange);
  const selectedTransactions = state.transactions.filter((transaction) => isInDateRange(transaction.date, range));
  const categoryAnalytics = buildCategoryAnalytics(state.categories, state.transactions, range);
  const categories = categoryAnalytics.rows
    .filter((row) => row.spendingMinor > 0 && !row.isUncategorized && !row.isNonSpending)
    .sort((left, right) => right.spendingMinor - left.spendingMinor || left.category.name.localeCompare(right.category.name));
  const budgetAttention = categories
    .flatMap((row) => {
      const reason = attentionReason(row);
      return reason ? [{row, reason}] : [];
    })
    .sort((left, right) => attentionRank(left.reason) - attentionRank(right.reason)
      || right.row.spendingMinor - left.row.spendingMinor)
    .slice(0, 4);
  const accountNames = new Map(state.accounts.map((account) => [account.id, account.name]));
  const categoryNames = new Map(state.categories.map((category) => [category.id, category.name]));

  return {
    currentSummary,
    previousSummary,
    previousRange,
    metrics: [
      buildMetric('spending', 'Spending', currentSummary.spendingMinor, previousSummary.spendingMinor),
      buildMetric('income', 'Income', currentSummary.incomeMinor, previousSummary.incomeMinor),
      buildMetric('net', 'Net cash flow', currentSummary.netCashFlowMinor, previousSummary.netCashFlowMinor),
      buildMetric('transactions', 'Transactions', currentSummary.transactionCount, previousSummary.transactionCount),
    ] satisfies DashboardMetric[],
    timeline: aggregateTimeline(selectedTransactions, range),
    categories,
    totalCategorizedSpendingMinor: categoryAnalytics.overview.totalCategorizedSpendingMinor,
    budgetAttention,
    accounts: state.accounts as Account[],
    recentTransactions: [...selectedTransactions]
      .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
      .slice(0, 7)
      .map((transaction): DashboardRecentTransaction => ({
        transaction,
        accountName: accountNames.get(transaction.accountId) ?? 'Unknown account',
        categoryName: categoryNames.get(transaction.categoryId) ?? 'Uncategorized',
      })),
  };
}
