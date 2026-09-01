import type {DateRange} from '@astryxdesign/core/DateRangeInput';

import {isInDateRange} from './date-range';

interface SummaryTransaction {
  date: string;
  amountMinor: number;
  kind: 'expense' | 'income';
  reviewStatus: 'confirmed' | 'needs_review';
}

export function summarizeTransactions(transactions: SummaryTransaction[], range: DateRange) {
  const selected = transactions.filter((transaction) => isInDateRange(transaction.date, range));
  const spendingMinor = selected.filter(({kind}) => kind === 'expense').reduce((sum, transaction) => sum + transaction.amountMinor, 0);
  const incomeMinor = selected.filter(({kind}) => kind === 'income').reduce((sum, transaction) => sum + transaction.amountMinor, 0);
  return {
    spendingMinor,
    incomeMinor,
    netCashFlowMinor: incomeMinor - spendingMinor,
    transactionCount: selected.length,
    needsReviewCount: selected.filter(({reviewStatus}) => reviewStatus === 'needs_review').length,
  };
}

export type MetricComparison = {
  percent: number | null;
  direction: 'lower' | 'higher' | 'unchanged' | 'new';
};

export function compareMetric(current: number, previous: number): MetricComparison {
  if (current === previous) return {percent: 0, direction: 'unchanged'};
  if (previous === 0) return {percent: null, direction: 'new'};
  return {
    percent: Math.round(Math.abs((current - previous) / previous) * 100),
    direction: current < previous ? 'lower' : 'higher',
  };
}
