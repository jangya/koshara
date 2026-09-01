import {describe, expect, it} from 'vitest';

import {
  buildCashflowChartViewModel,
  configureCashflowChart,
  getCashflowChartConfiguration,
  resetCashflowChart,
} from './cashflow-chart';
import type {KosharaState} from './koshara-types';

const state: KosharaState = {
  accounts: [
    {id: 'a', name: 'Primary', type: 'bank', balanceMinor: 0, color: 'blue'},
    {id: 'b', name: 'Card', type: 'credit-card', balanceMinor: 0, color: 'orange'},
  ],
  categories: [
    {id: 'food', name: 'Food', budgetMinor: null, color: 'green'},
    {id: 'rent', name: 'Rent', budgetMinor: null, color: 'purple'},
    {id: 'income', name: 'Income', budgetMinor: null, color: 'green'},
  ],
  transactions: [
    {id: 'previous-expense', date: '2026-07-19', description: 'Food', amountMinor: 5_000, kind: 'expense', accountId: 'a', categoryId: 'food', notes: '', reviewStatus: 'confirmed', source: 'demo', createdAt: '2026-07-19T12:00:00Z'},
    {id: 'previous-income', date: '2026-07-20', description: 'Pay', amountMinor: 10_000, kind: 'income', accountId: 'a', categoryId: 'income', notes: '', reviewStatus: 'confirmed', source: 'demo', createdAt: '2026-07-20T12:00:00Z'},
    {id: 'food-a', date: '2026-08-02', description: 'Food', amountMinor: 12_000, kind: 'expense', accountId: 'a', categoryId: 'food', notes: '', reviewStatus: 'confirmed', source: 'demo', createdAt: '2026-08-02T12:00:00Z'},
    {id: 'rent-a', date: '2026-08-08', description: 'Rent', amountMinor: 8_000, kind: 'expense', accountId: 'a', categoryId: 'rent', notes: '', reviewStatus: 'confirmed', source: 'demo', createdAt: '2026-08-08T12:00:00Z'},
    {id: 'food-b', date: '2026-08-09', description: 'Food', amountMinor: 4_000, kind: 'expense', accountId: 'b', categoryId: 'food', notes: '', reviewStatus: 'confirmed', source: 'demo', createdAt: '2026-08-09T12:00:00Z'},
    {id: 'income-a', date: '2026-08-12', description: 'Pay', amountMinor: 50_000, kind: 'income', accountId: 'a', categoryId: 'income', notes: '', reviewStatus: 'confirmed', source: 'demo', createdAt: '2026-08-12T12:00:00Z'},
  ],
  importSessions: [],
};

describe('cash-flow chart view model', () => {
  it('groups weekly, compares the preceding period, filters accounts, and marks highlighted causes', () => {
    const before = structuredClone(state);
    const view = buildCashflowChartViewModel(state, {start: '2026-08-01', end: '2026-08-14'}, {
      mode: 'spending',
      grouping: 'weekly',
      dateRange: {from: '2026-08-01', to: '2026-08-14'},
      accountIds: ['a'],
      categoryIds: [],
      comparePreviousPeriod: true,
      highlightedDates: ['2026-08-08'],
      highlightedCategoryIds: ['rent'],
      insightTitle: 'Rent drove the second-week increase',
    });

    expect(view.points).toHaveLength(2);
    expect(view.points[0]).toMatchObject({spendingMinor: 12_000, previousSpendingMinor: 5_000});
    expect(view.points[1]).toMatchObject({spendingMinor: 8_000, incomeMinor: 50_000, highlightedSpendingMinor: 8_000, isDateHighlighted: true});
    expect(view.accountNames).toEqual(['Primary']);
    expect(view.highlightedCategoryNames).toEqual(['Rent']);
    expect(view.previousPeriod).toBe('18–31 July 2026');
    expect(state).toEqual(before);
  });

  it('applies category filters without changing the underlying transactions', () => {
    const view = buildCashflowChartViewModel(state, {start: '2026-08-01', end: '2026-08-14'}, {
      mode: 'combined',
      grouping: 'daily',
      accountIds: [],
      categoryIds: ['food'],
      comparePreviousPeriod: false,
      highlightedDates: [],
      highlightedCategoryIds: [],
    });

    expect(view.totalSpendingMinor).toBe(16_000);
    expect(view.totalIncomeMinor).toBe(0);
    expect(view.categoryNames).toEqual(['Food']);
  });
});

describe('temporary cash-flow chart configuration', () => {
  it('publishes an agent configuration and resets it without persistence', () => {
    resetCashflowChart();
    configureCashflowChart({
      mode: 'income',
      grouping: 'monthly',
      accountIds: [],
      categoryIds: [],
      comparePreviousPeriod: true,
      highlightedDates: [],
      highlightedCategoryIds: [],
      insightTitle: 'Income changed after the annual bonus',
    });

    expect(getCashflowChartConfiguration()).toMatchObject({mode: 'income', grouping: 'monthly'});
    resetCashflowChart();
    expect(getCashflowChartConfiguration()).toBeNull();
  });
});
