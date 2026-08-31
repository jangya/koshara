import type {DateRange} from '@astryxdesign/core/DateRangeInput';

import {getBudgetStatus, type BudgetStatus} from './category-rules';
import {getPreviousPeriod, isInDateRange} from './date-range';
import {compareMetric, type MetricComparison} from './finance-insights';
import type {Category, Transaction} from './koshara-types';

export type CategoryViewFilter = 'active' | 'all' | 'over-budget' | 'near-limit' | 'needs-budget' | 'uncategorized';
export type CategorySortKey = 'attention' | 'name' | 'spending' | 'usage' | 'change';

export interface CategoryTrendPoint {
  month: string;
  label: string;
  amountMinor: number;
}

export interface MerchantSummary {
  merchant: string;
  amountMinor: number;
  transactionCount: number;
}

export interface CategoryAnalyticsRow {
  category: Category;
  spendingMinor: number;
  previousSpendingMinor: number;
  transactionCount: number;
  averageMinor: number;
  budgetLimitMinor: number | null;
  remainingMinor: number | null;
  budgetStatus: BudgetStatus | null;
  change: MetricComparison;
  trend: CategoryTrendPoint[];
  topMerchants: MerchantSummary[];
  recentTransactions: Transaction[];
  recurringPayments: string[];
  isUncategorized: boolean;
  isNonSpending: boolean;
}

export interface AttentionGroup {
  count: number;
  amountMinor: number;
  transactionIds: string[];
}

const nonSpendingCategoryIds = new Set(['income', 'transfer', 'investment']);

function monthKeys(end: string, count: number) {
  const [year = 0, month = 1] = end.split('-').map(Number);
  return Array.from({length: count}, (_, index) => {
    const date = new Date(year, month - count + index, 1, 12);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('en-IN', {month: 'short'}).format(date);
    return {key, label};
  });
}

function monthCount(range: DateRange) {
  const [startYear = 0, startMonth = 1] = range.start.split('-').map(Number);
  const [endYear = 0, endMonth = 1] = range.end.split('-').map(Number);
  return Math.max(1, (endYear - startYear) * 12 + endMonth - startMonth + 1);
}

function isCategoryActivity(transaction: Transaction, categoryId: string) {
  return transaction.categoryId === categoryId && (categoryId === 'income' ? transaction.kind === 'income' : transaction.kind === 'expense');
}

function selectedCategoryActivity(transactions: Transaction[], range: DateRange, categoryId: string) {
  return transactions.filter((transaction) => isCategoryActivity(transaction, categoryId)
    && isInDateRange(transaction.date, range));
}

function buildTrend(transactions: Transaction[], categoryId: string, range: DateRange): CategoryTrendPoint[] {
  return monthKeys(range.end, 6).map(({key, label}) => ({
    month: key,
    label,
    amountMinor: transactions
      .filter((transaction) => isCategoryActivity(transaction, categoryId) && transaction.date.startsWith(key))
      .reduce((total, transaction) => total + transaction.amountMinor, 0),
  }));
}

function topMerchants(transactions: Transaction[]): MerchantSummary[] {
  const merchants = new Map<string, MerchantSummary>();
  transactions.forEach((transaction) => {
    const key = transaction.description.trim().toLocaleLowerCase();
    const current = merchants.get(key);
    merchants.set(key, {
      merchant: current?.merchant ?? transaction.description.trim(),
      amountMinor: (current?.amountMinor ?? 0) + transaction.amountMinor,
      transactionCount: (current?.transactionCount ?? 0) + 1,
    });
  });
  return [...merchants.values()].sort((a, b) => b.amountMinor - a.amountMinor || a.merchant.localeCompare(b.merchant)).slice(0, 5);
}

function recurringPayments(transactions: Transaction[], categoryId: string, range: DateRange) {
  const earliestMonth = monthKeys(range.end, 6)[0]?.key ?? range.start.slice(0, 7);
  const merchants = new Map<string, {label: string; months: Set<string>}>();
  transactions
    .filter((transaction) => isCategoryActivity(transaction, categoryId)
      && transaction.date.slice(0, 7) >= earliestMonth
      && transaction.date <= range.end)
    .forEach((transaction) => {
      const key = transaction.description.trim().toLocaleLowerCase();
      const current = merchants.get(key) ?? {label: transaction.description.trim(), months: new Set<string>()};
      current.months.add(transaction.date.slice(0, 7));
      merchants.set(key, current);
    });
  return [...merchants.values()]
    .filter(({months}) => months.size >= 3)
    .sort((a, b) => b.months.size - a.months.size || a.label.localeCompare(b.label))
    .map(({label}) => label);
}

export function buildCategoryAnalytics(categories: Category[], transactions: Transaction[], range: DateRange) {
  const previousRange = getPreviousPeriod(range);
  const rows: CategoryAnalyticsRow[] = categories.map((category) => {
    const currentTransactions = selectedCategoryActivity(transactions, range, category.id);
    const previousTransactions = selectedCategoryActivity(transactions, previousRange, category.id);
    const spendingMinor = currentTransactions.reduce((total, transaction) => total + transaction.amountMinor, 0);
    const previousSpendingMinor = previousTransactions.reduce((total, transaction) => total + transaction.amountMinor, 0);
    const isUncategorized = category.id === 'uncategorized';
    const isNonSpending = nonSpendingCategoryIds.has(category.id);
    const budgetLimitMinor = category.budgetMinor === null ? null : category.budgetMinor * monthCount(range);
    const budgetStatus = budgetLimitMinor !== null && !isUncategorized && !isNonSpending
      ? getBudgetStatus(spendingMinor, budgetLimitMinor)
      : null;
    return {
      category,
      spendingMinor,
      previousSpendingMinor,
      transactionCount: currentTransactions.length,
      averageMinor: currentTransactions.length ? Math.round(spendingMinor / currentTransactions.length) : 0,
      budgetLimitMinor,
      remainingMinor: budgetLimitMinor === null ? null : budgetLimitMinor - spendingMinor,
      budgetStatus,
      change: compareMetric(spendingMinor, previousSpendingMinor),
      trend: buildTrend(transactions, category.id, range),
      topMerchants: topMerchants(currentTransactions),
      recentTransactions: [...currentTransactions]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
      recurringPayments: recurringPayments(transactions, category.id, range),
      isUncategorized,
      isNonSpending,
    };
  });
  const ordinaryRows = rows.filter((row) => !row.isUncategorized && !row.isNonSpending);
  const uncategorized = rows.find(({isUncategorized}) => isUncategorized);
  return {
    rows,
    overview: {
      totalCategorizedSpendingMinor: ordinaryRows.reduce((total, row) => total + row.spendingMinor, 0),
      activeCategoryCount: ordinaryRows.filter(({spendingMinor}) => spendingMinor > 0).length,
      overBudgetCount: ordinaryRows.filter(({budgetStatus}) => budgetStatus?.label === 'Over budget').length,
      nearBudgetCount: ordinaryRows.filter(({budgetStatus}) => budgetStatus?.label === 'Near limit').length,
      uncategorizedAmountMinor: uncategorized?.spendingMinor ?? 0,
      uncategorizedCount: uncategorized?.transactionCount ?? 0,
      categoriesWithoutBudgetCount: ordinaryRows.filter(({category}) => category.budgetMinor === null).length,
    },
  };
}

export function filterCategoryAnalytics(rows: CategoryAnalyticsRow[], filter: CategoryViewFilter) {
  if (filter === 'all') return rows;
  if (filter === 'uncategorized') return rows.filter(({isUncategorized}) => isUncategorized);
  if (filter === 'over-budget') return rows.filter(({budgetStatus}) => budgetStatus?.label === 'Over budget');
  if (filter === 'near-limit') return rows.filter(({budgetStatus}) => budgetStatus?.label === 'Near limit');
  if (filter === 'needs-budget') return rows.filter((row) => !row.isUncategorized && !row.isNonSpending && row.category.budgetMinor === null);
  return rows.filter((row) => !row.isUncategorized && !row.isNonSpending && row.spendingMinor > 0);
}

function attentionRank(row: CategoryAnalyticsRow) {
  if (row.isUncategorized && row.spendingMinor > 0) return 0;
  if (row.budgetStatus?.label === 'Over budget') return 1;
  if (row.budgetStatus?.label === 'Near limit') return 2;
  if (!row.isUncategorized && !row.isNonSpending && row.spendingMinor > 0 && row.category.budgetMinor === null) return 3;
  if (row.spendingMinor > 0 && !row.isNonSpending) return 4;
  if (row.spendingMinor === 0) return 5;
  return 6;
}

export function sortCategoryAnalytics(rows: CategoryAnalyticsRow[], sort: CategorySortKey) {
  return [...rows].sort((a, b) => {
    if (sort === 'name') return a.category.name.localeCompare(b.category.name);
    if (sort === 'spending') return b.spendingMinor - a.spendingMinor || a.category.name.localeCompare(b.category.name);
    if (sort === 'usage') {
      const aUsage = a.budgetLimitMinor === null ? -1 : a.budgetLimitMinor === 0 ? (a.spendingMinor > 0 ? Number.POSITIVE_INFINITY : 0) : a.spendingMinor / a.budgetLimitMinor;
      const bUsage = b.budgetLimitMinor === null ? -1 : b.budgetLimitMinor === 0 ? (b.spendingMinor > 0 ? Number.POSITIVE_INFINITY : 0) : b.spendingMinor / b.budgetLimitMinor;
      return bUsage - aUsage || b.spendingMinor - a.spendingMinor;
    }
    if (sort === 'change') return (b.spendingMinor - b.previousSpendingMinor) - (a.spendingMinor - a.previousSpendingMinor);
    return attentionRank(a) - attentionRank(b) || b.spendingMinor - a.spendingMinor || a.category.name.localeCompare(b.category.name);
  });
}

export function findIncreasingCategory(rows: CategoryAnalyticsRow[]) {
  return rows
    .filter((row) => !row.isUncategorized && !row.isNonSpending)
    .map((row) => ({row, points: row.trend.slice(-3).map(({amountMinor}) => amountMinor)}))
    .filter(({points}) => points.length === 3 && points[0]! > 0 && points[0]! < points[1]! && points[1]! < points[2]!)
    .sort((a, b) => (b.points[2]! - b.points[0]!) - (a.points[2]! - a.points[0]!))[0]?.row;
}

function attentionGroup(transactions: Transaction[]): AttentionGroup {
  return {
    count: transactions.length,
    amountMinor: transactions.reduce((total, transaction) => total + transaction.amountMinor, 0),
    transactionIds: transactions.map(({id}) => id),
  };
}

export function buildAttentionSummary(transactions: Transaction[], range: DateRange) {
  const selected = transactions.filter((transaction) => isInDateRange(transaction.date, range));
  const needsReviewTransactions = selected.filter(({reviewStatus}) => reviewStatus === 'needs_review');
  const uncategorizedTransactions = selected.filter(({categoryId}) => categoryId === 'uncategorized');
  const combinedById = new Map([...needsReviewTransactions, ...uncategorizedTransactions].map((transaction) => [transaction.id, transaction]));
  return {
    needsReview: attentionGroup(needsReviewTransactions),
    uncategorized: attentionGroup(uncategorizedTransactions),
    combined: attentionGroup([...combinedById.values()]),
  };
}

export function findPossibleDuplicateGroups(transactions: Transaction[], range: DateRange) {
  const groups = new Map<string, Transaction[]>();
  transactions.filter((transaction) => isInDateRange(transaction.date, range)).forEach((transaction) => {
    const fingerprint = [transaction.date, transaction.amountMinor, transaction.description.trim().toLocaleLowerCase(), transaction.accountId].join('|');
    groups.set(fingerprint, [...(groups.get(fingerprint) ?? []), transaction]);
  });
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      description: group[0]!.description,
      date: group[0]!.date,
      amountMinor: group[0]!.amountMinor,
      accountId: group[0]!.accountId,
      transactionIds: group.map(({id}) => id),
    }));
}
