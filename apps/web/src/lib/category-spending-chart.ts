import type {DateRange} from '@astryxdesign/core/DateRangeInput';

import {buildCategoryAnalytics} from './category-analytics';
import {formatDateRange} from './date-range';
import type {CategoryColor, KosharaState} from './koshara-types';

export interface CategorySpendingChartConfiguration {
  dateRange?: {from: string; to: string};
  accountIds: string[];
  categoryIds: string[];
  highlightedCategoryIds: string[];
  insightTitle?: string;
}

let configuration: CategorySpendingChartConfiguration | null = null;
const listeners = new Set<() => void>();

export function subscribeCategorySpendingChart(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCategorySpendingChartConfiguration() {
  return configuration;
}

export function configureCategorySpendingChart(next: CategorySpendingChartConfiguration) {
  configuration = {
    ...next,
    dateRange: next.dateRange ? {...next.dateRange} : undefined,
    accountIds: [...next.accountIds],
    categoryIds: [...next.categoryIds],
    highlightedCategoryIds: [...next.highlightedCategoryIds],
  };
  listeners.forEach((listener) => listener());
  return configuration;
}

export function resetCategorySpendingChart() {
  if (!configuration) return;
  configuration = null;
  listeners.forEach((listener) => listener());
}

export function buildCategorySpendingChartViewModel(
  state: KosharaState,
  defaultRange: DateRange,
  config: CategorySpendingChartConfiguration | null,
) {
  const range: DateRange = config?.dateRange
    ? {start: config.dateRange.from as DateRange['start'], end: config.dateRange.to as DateRange['end']}
    : defaultRange;
  const accountIds = new Set(config?.accountIds ?? []);
  const categoryIds = new Set(config?.categoryIds ?? []);
  const highlightedCategoryIds = new Set(config?.highlightedCategoryIds ?? []);
  const transactions = state.transactions.filter(({accountId}) => accountIds.size === 0 || accountIds.has(accountId));
  const rows = buildCategoryAnalytics(state.categories, transactions, range).rows
    .filter((row) => !row.isUncategorized && !row.isNonSpending && row.spendingMinor > 0)
    .filter((row) => categoryIds.size === 0 || categoryIds.has(row.category.id))
    .sort((left, right) => right.spendingMinor - left.spendingMinor || left.category.name.localeCompare(right.category.name));
  const visibleRows = rows.slice(0, 7);
  const remainingMinor = rows.slice(7).reduce((sum, row) => sum + row.spendingMinor, 0);
  const points: Array<{
    categoryId: string;
    name: string;
    value: number;
    color: CategoryColor | 'gray';
    budgetStatus: (typeof rows)[number]['budgetStatus'];
    isHighlighted: boolean;
  }> = visibleRows.map((row) => ({
    categoryId: row.category.id,
    name: row.category.name,
    value: row.spendingMinor,
    color: row.category.color,
    budgetStatus: row.budgetStatus,
    isHighlighted: highlightedCategoryIds.has(row.category.id),
  }));
  if (remainingMinor > 0) {
    points.push({categoryId: 'other', name: 'Other', value: remainingMinor, color: 'gray', budgetStatus: null, isHighlighted: false});
  }
  const namesFor = (ids: string[], values: Array<{id: string; name: string}>) => ids
    .map((id) => values.find((value) => value.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return {
    range,
    period: formatDateRange(range),
    rows,
    points,
    totalSpendingMinor: rows.reduce((sum, row) => sum + row.spendingMinor, 0),
    accountNames: namesFor(config?.accountIds ?? [], state.accounts),
    categoryNames: namesFor(config?.categoryIds ?? [], state.categories),
    highlightedCategoryNames: namesFor(config?.highlightedCategoryIds ?? [], state.categories),
  };
}
