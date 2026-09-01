import type {DateRange} from '@astryxdesign/core/DateRangeInput';

import {
  aggregateTimeline,
  formatDateRange,
  getPreviousPeriod,
  getTimelineGrouping,
  getTimelineKey,
  type TimelineGrouping,
  type TimelinePoint,
} from './date-range';
import type {KosharaState} from './koshara-types';

export type CashflowChartMode = 'combined' | 'spending' | 'income';

export interface CashflowChartConfiguration {
  mode: CashflowChartMode;
  grouping: TimelineGrouping;
  dateRange?: {from: string; to: string};
  accountIds: string[];
  categoryIds: string[];
  comparePreviousPeriod: boolean;
  highlightedDates: string[];
  highlightedCategoryIds: string[];
  insightTitle?: string;
}

export interface CashflowChartPoint extends TimelinePoint {
  previousLabel?: string;
  previousIncomeMinor?: number;
  previousSpendingMinor?: number;
  highlightedSpendingMinor: number;
  isDateHighlighted: boolean;
}

let configuration: CashflowChartConfiguration | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeCashflowChart(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCashflowChartConfiguration() {
  return configuration;
}

export function configureCashflowChart(next: CashflowChartConfiguration) {
  configuration = {
    ...next,
    dateRange: next.dateRange ? {...next.dateRange} : undefined,
    accountIds: [...next.accountIds],
    categoryIds: [...next.categoryIds],
    highlightedDates: [...next.highlightedDates],
    highlightedCategoryIds: [...next.highlightedCategoryIds],
  };
  emit();
  return configuration;
}

export function resetCashflowChart() {
  if (!configuration) return;
  configuration = null;
  emit();
}

function filterTransactions(state: KosharaState, config: CashflowChartConfiguration | null) {
  const accountIds = new Set(config?.accountIds ?? []);
  const categoryIds = new Set(config?.categoryIds ?? []);
  return state.transactions
    .filter(({accountId}) => accountIds.size === 0 || accountIds.has(accountId))
    .filter(({categoryId}) => categoryIds.size === 0 || categoryIds.has(categoryId));
}

export function buildCashflowChartViewModel(
  state: KosharaState,
  defaultRange: DateRange,
  config: CashflowChartConfiguration | null,
) {
  const range: DateRange = config?.dateRange
    ? {start: config.dateRange.from as DateRange['start'], end: config.dateRange.to as DateRange['end']}
    : defaultRange;
  const grouping = getTimelineGrouping(range, config?.grouping ?? 'auto');
  const scopedTransactions = filterTransactions(state, config);
  const currentPoints = aggregateTimeline(scopedTransactions, range, grouping);
  const previousRange = getPreviousPeriod(range);
  const previousPoints = config?.comparePreviousPeriod
    ? aggregateTimeline(scopedTransactions, previousRange, grouping)
    : [];
  const highlightedCategoryIds = new Set(config?.highlightedCategoryIds ?? []);
  const highlightedPoints = aggregateTimeline(
    scopedTransactions.filter(({categoryId, kind}) => kind === 'expense' && highlightedCategoryIds.has(categoryId)),
    range,
    grouping,
  );
  const highlightedPointKeys = new Set((config?.highlightedDates ?? [])
    .filter((date) => date >= range.start && date <= range.end)
    .map((date) => getTimelineKey(date, range, grouping)));
  const points: CashflowChartPoint[] = currentPoints.map((point, index) => ({
    ...point,
    previousLabel: previousPoints[index]?.label,
    previousIncomeMinor: previousPoints[index]?.incomeMinor,
    previousSpendingMinor: previousPoints[index]?.spendingMinor,
    highlightedSpendingMinor: highlightedPoints[index]?.spendingMinor ?? 0,
    isDateHighlighted: highlightedPointKeys.has(point.key),
  }));
  const namesFor = (ids: string[], values: Array<{id: string; name: string}>) => ids
    .map((id) => values.find((value) => value.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return {
    range,
    period: formatDateRange(range),
    previousRange,
    previousPeriod: formatDateRange(previousRange),
    grouping,
    points,
    totalIncomeMinor: points.reduce((sum, point) => sum + point.incomeMinor, 0),
    totalSpendingMinor: points.reduce((sum, point) => sum + point.spendingMinor, 0),
    accountNames: namesFor(config?.accountIds ?? [], state.accounts),
    categoryNames: namesFor(config?.categoryIds ?? [], state.categories),
    highlightedCategoryNames: namesFor(config?.highlightedCategoryIds ?? [], state.categories),
  };
}
