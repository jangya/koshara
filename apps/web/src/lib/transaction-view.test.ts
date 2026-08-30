import {describe, expect, it} from 'vitest';

import {filterAndSortTransactions, parseTransactionViewParams, toggleSelection} from './transaction-view';

const transactions = [
  {id: 'a', date: '2026-08-02', description: 'Cafe', notes: 'team lunch', amountMinor: 4500, kind: 'expense' as const, accountId: 'bank', categoryId: 'dining', reviewStatus: 'needs_review' as const},
  {id: 'b', date: '2026-08-01', description: 'Salary', notes: '', amountMinor: 100_000, kind: 'income' as const, accountId: 'bank', categoryId: 'income', reviewStatus: 'confirmed' as const},
  {id: 'c', date: '2026-07-31', description: 'Cafe', notes: '', amountMinor: 2000, kind: 'expense' as const, accountId: 'cash', categoryId: 'dining', reviewStatus: 'confirmed' as const},
];

describe('URL-backed transaction view state', () => {
  it('parses date, filters, sorting, and pagination with safe defaults', () => {
    const parsed = parseTransactionViewParams(new URLSearchParams('from=2026-08-01&to=2026-08-31&q=cafe&account=bank&category=dining&type=expense&review=needs_review&sort=amount&direction=asc&page=2&pageSize=25'));
    expect(parsed).toMatchObject({
      range: {start: '2026-08-01', end: '2026-08-31'},
      query: 'cafe',
      accountId: 'bank',
      categoryId: 'dining',
      kind: 'expense',
      reviewStatus: 'needs_review',
      sortBy: 'amount',
      sortDirection: 'ascending',
      page: 2,
      pageSize: 25,
    });
  });

  it('filters by all active criteria and sorts amount deterministically', () => {
    const visible = filterAndSortTransactions(transactions, {
      range: {start: '2026-08-01', end: '2026-08-31'},
      query: 'lunch',
      accountId: 'bank',
      categoryId: 'dining',
      kind: 'expense',
      reviewStatus: 'needs_review',
      sortBy: 'amount',
      sortDirection: 'ascending',
    });
    expect(visible.map(({id}) => id)).toEqual(['a']);
  });

  it('adds and removes selected rows without mutating the previous set', () => {
    const initial = new Set(['a']);
    const added = toggleSelection(initial, 'b', true);
    const removed = toggleSelection(added, 'a', false);
    expect([...initial]).toEqual(['a']);
    expect([...added]).toEqual(['a', 'b']);
    expect([...removed]).toEqual(['b']);
  });
});
