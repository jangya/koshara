import {describe, expect, it} from 'vitest';

import {
  buildAttentionSummary,
  buildCategoryAnalytics,
  filterCategoryAnalytics,
  findIncreasingCategory,
  findPossibleDuplicateGroups,
  sortCategoryAnalytics,
} from './category-analytics';
import type {Category, Transaction} from './koshara-types';

const categories: Category[] = [
  {id: 'shopping', name: 'Shopping', budgetMinor: 900_000, color: 'pink'},
  {id: 'dining', name: 'Dining', budgetMinor: 1_000_000, color: 'orange'},
  {id: 'entertainment', name: 'Entertainment', budgetMinor: null, color: 'purple'},
  {id: 'groceries', name: 'Groceries', budgetMinor: 1_000_000, color: 'green'},
  {id: 'investment', name: 'Investment', budgetMinor: null, color: 'green'},
  {id: 'income', name: 'Income', budgetMinor: null, color: 'green'},
  {id: 'uncategorized', name: 'Uncategorized', budgetMinor: null, color: 'purple'},
];

function transaction(input: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'description' | 'amountMinor' | 'categoryId'>): Transaction {
  return {
    kind: 'expense',
    accountId: 'account',
    notes: '',
    reviewStatus: 'confirmed',
    source: 'demo',
    createdAt: `${input.date}T12:00:00.000Z`,
    ...input,
  };
}

const transactions: Transaction[] = [
  transaction({id: 'shop-1', date: '2026-08-04', description: 'Amazon India', amountMinor: 700_000, categoryId: 'shopping'}),
  transaction({id: 'shop-2', date: '2026-08-18', description: 'Amazon India', amountMinor: 300_000, categoryId: 'shopping'}),
  transaction({id: 'dine-1', date: '2026-08-07', description: 'Swiggy', amountMinor: 350_000, categoryId: 'dining'}),
  transaction({id: 'dine-2', date: '2026-08-21', description: 'Zomato', amountMinor: 350_000, categoryId: 'dining'}),
  transaction({id: 'fun-1', date: '2026-08-12', description: 'PVR Cinemas', amountMinor: 120_000, categoryId: 'entertainment'}),
  transaction({id: 'uncat-overlap', date: '2026-08-15', description: 'POS KIOSK', amountMinor: 90_000, categoryId: 'uncategorized', reviewStatus: 'needs_review'}),
  transaction({id: 'review-only', date: '2026-08-16', description: 'RSP FOOD', amountMinor: 60_000, categoryId: 'dining', reviewStatus: 'needs_review'}),
  transaction({id: 'uncat-only', date: '2026-08-17', description: 'UPI 123', amountMinor: 40_000, categoryId: 'uncategorized'}),
  transaction({id: 'shop-prev', date: '2026-07-20', description: 'Myntra', amountMinor: 500_000, categoryId: 'shopping'}),
  transaction({id: 'dine-jun', date: '2026-06-10', description: 'Swiggy', amountMinor: 100_000, categoryId: 'dining'}),
  transaction({id: 'dine-jul', date: '2026-07-10', description: 'Swiggy', amountMinor: 200_000, categoryId: 'dining'}),
  transaction({id: 'swiggy-duplicate-a', date: '2026-08-29', description: 'Swiggy', amountMinor: 80_000, categoryId: 'dining'}),
  transaction({id: 'swiggy-duplicate-b', date: '2026-08-29', description: 'Swiggy', amountMinor: 80_000, categoryId: 'dining'}),
  transaction({id: 'salary', date: '2026-08-01', description: 'Salary credit', amountMinor: 10_000_000, categoryId: 'income', kind: 'income'}),
];

const range = {start: '2026-08-01', end: '2026-08-31'} as const;

describe('category analytics', () => {
  it('calculates date-aware overview, budget, count, average, and comparison facts', () => {
    const result = buildCategoryAnalytics(categories, transactions, range);
    const shopping = result.rows.find(({category}) => category.id === 'shopping')!;
    const dining = result.rows.find(({category}) => category.id === 'dining')!;

    expect(result.overview).toMatchObject({
      totalCategorizedSpendingMinor: 2_040_000,
      activeCategoryCount: 3,
      overBudgetCount: 1,
      nearBudgetCount: 1,
      uncategorizedAmountMinor: 130_000,
      uncategorizedCount: 2,
      categoriesWithoutBudgetCount: 1,
    });
    expect(shopping).toMatchObject({spendingMinor: 1_000_000, transactionCount: 2, averageMinor: 500_000, remainingMinor: -100_000});
    expect(shopping.budgetStatus?.label).toBe('Over budget');
    expect(shopping.change).toMatchObject({direction: 'higher', percent: 100});
    expect(dining.budgetStatus?.label).toBe('Near limit');
    expect(result.rows.find(({category}) => category.id === 'income')).toMatchObject({spendingMinor: 10_000_000, transactionCount: 1, isNonSpending: true});
  });

  it('builds six-month trends, top merchants, recent transactions, and recurring payments', () => {
    const dining = buildCategoryAnalytics(categories, transactions, range).rows.find(({category}) => category.id === 'dining')!;

    expect(dining.trend).toHaveLength(6);
    expect(dining.trend.slice(-3).map(({amountMinor}) => amountMinor)).toEqual([100_000, 200_000, 920_000]);
    expect(dining.topMerchants[0]).toMatchObject({merchant: 'Swiggy', transactionCount: 3});
    expect(dining.recentTransactions[0]?.date).toBe('2026-08-29');
    expect(dining.recurringPayments).toContain('Swiggy');
    expect(findIncreasingCategory(buildCategoryAnalytics(categories, transactions, range).rows)?.category.id).toBe('dining');
  });

  it('filters and sorts attention-first without letting inactive categories dominate', () => {
    const rows = buildCategoryAnalytics(categories, transactions, range).rows;

    expect(filterCategoryAnalytics(rows, 'over-budget').map(({category}) => category.id)).toEqual(['shopping']);
    expect(filterCategoryAnalytics(rows, 'near-limit').map(({category}) => category.id)).toEqual(['dining']);
    expect(filterCategoryAnalytics(rows, 'needs-budget').map(({category}) => category.id)).toEqual(['entertainment']);
    expect(filterCategoryAnalytics(rows, 'uncategorized').map(({category}) => category.id)).toEqual(['uncategorized']);
    expect(sortCategoryAnalytics(rows, 'attention').slice(0, 3).map(({category}) => category.id)).toEqual(['uncategorized', 'shopping', 'dining']);
  });

  it('scales monthly budgets across multi-month selected ranges', () => {
    const shopping = buildCategoryAnalytics(categories, transactions, {start: '2026-07-01', end: '2026-08-31'})
      .rows.find(({category}) => category.id === 'shopping')!;

    expect(shopping).toMatchObject({spendingMinor: 1_500_000, budgetLimitMinor: 1_800_000, remainingMinor: 300_000});
    expect(shopping.budgetStatus?.label).toBe('Watch');
  });
});

describe('attention analytics', () => {
  it('keeps review and uncategorized groups separate while deduplicating the combined total', () => {
    const attention = buildAttentionSummary(transactions, range);

    expect(attention.needsReview).toMatchObject({count: 2, amountMinor: 150_000});
    expect(attention.uncategorized).toMatchObject({count: 2, amountMinor: 130_000});
    expect(attention.combined).toMatchObject({count: 3, amountMinor: 190_000});
  });

  it('returns calm empty facts when nothing requires attention', () => {
    expect(buildAttentionSummary(transactions, {start: '2025-01-01', end: '2025-01-31'}).combined).toEqual({count: 0, amountMinor: 0, transactionIds: []});
  });
});

describe('possible duplicate facts', () => {
  it('returns exact duplicate groups without treating recurring payments in different months as duplicates', () => {
    const groups = findPossibleDuplicateGroups(transactions, range);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({description: 'Swiggy', amountMinor: 80_000, transactionIds: ['swiggy-duplicate-a', 'swiggy-duplicate-b']});
  });
});
