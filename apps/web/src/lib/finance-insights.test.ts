import {describe, expect, it} from 'vitest';

import {compareMetric, summarizeTransactions} from './finance-insights';

describe('dashboard financial summaries', () => {
  const transactions = [
    {date: '2026-08-01', kind: 'income' as const, amountMinor: 100_000, reviewStatus: 'confirmed' as const},
    {date: '2026-08-02', kind: 'expense' as const, amountMinor: 30_000, reviewStatus: 'needs_review' as const},
    {date: '2026-08-03', kind: 'expense' as const, amountMinor: 20_000, reviewStatus: 'confirmed' as const},
    {date: '2026-07-31', kind: 'expense' as const, amountMinor: 90_000, reviewStatus: 'confirmed' as const},
  ];

  it('calculates spending, income, net cash flow, count, and review count from one range', () => {
    expect(summarizeTransactions(transactions, {start: '2026-08-01', end: '2026-08-03'})).toEqual({
      spendingMinor: 50_000,
      incomeMinor: 100_000,
      netCashFlowMinor: 50_000,
      transactionCount: 3,
      needsReviewCount: 1,
    });
  });

  it('expresses comparison direction in words and handles a zero baseline', () => {
    expect(compareMetric(88, 100)).toEqual({percent: 12, direction: 'lower'});
    expect(compareMetric(112, 100)).toEqual({percent: 12, direction: 'higher'});
    expect(compareMetric(0, 0)).toEqual({percent: 0, direction: 'unchanged'});
    expect(compareMetric(20, 0)).toEqual({percent: null, direction: 'new'});
  });
});
