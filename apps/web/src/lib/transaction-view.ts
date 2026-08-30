import type {DateRange} from '@astryxdesign/core/DateRangeInput';

import {parseDateRangeParams} from './date-range';

export type TransactionSortKey = 'date' | 'amount';
export type SortDirection = 'ascending' | 'descending';
export type TransactionKindFilter = 'all' | 'expense' | 'income';
export type TransactionReviewFilter = 'all' | 'needs_review';

export interface TransactionViewFilters {
  range: DateRange;
  query: string;
  accountId: string;
  categoryId: string;
  kind: TransactionKindFilter;
  reviewStatus: TransactionReviewFilter;
  sortBy: TransactionSortKey;
  sortDirection: SortDirection;
}

export interface TransactionViewState extends TransactionViewFilters {
  preset: ReturnType<typeof parseDateRangeParams>['preset'];
  page: number;
  pageSize: number;
}

interface FilterableTransaction {
  id: string;
  date: string;
  description: string;
  notes: string;
  amountMinor: number;
  kind: 'expense' | 'income';
  accountId: string;
  categoryId: string;
  reviewStatus: 'confirmed' | 'needs_review';
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseTransactionViewParams(params: URLSearchParams, now = new Date()): TransactionViewState {
  const dateState = parseDateRangeParams(params, now);
  const kind = params.get('type');
  const reviewStatus = params.get('review');
  const sortBy = params.get('sort');
  const direction = params.get('direction');
  const requestedPageSize = positiveInteger(params.get('pageSize'), 20);

  return {
    ...dateState,
    query: params.get('q') ?? '',
    accountId: params.get('account') ?? 'all',
    categoryId: params.get('category') ?? 'all',
    kind: kind === 'expense' || kind === 'income' ? kind : 'all',
    reviewStatus: reviewStatus === 'needs_review' ? reviewStatus : 'all',
    sortBy: sortBy === 'amount' ? 'amount' : 'date',
    sortDirection: direction === 'asc' ? 'ascending' : 'descending',
    page: positiveInteger(params.get('page'), 1),
    pageSize: [10, 20, 25, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20,
  };
}

export function filterAndSortTransactions<T extends FilterableTransaction>(transactions: T[], filters: TransactionViewFilters) {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase();
  return [...transactions]
    .filter((transaction) => transaction.date >= filters.range.start && transaction.date <= filters.range.end)
    .filter((transaction) => !normalizedQuery || `${transaction.description} ${transaction.notes}`.toLocaleLowerCase().includes(normalizedQuery))
    .filter((transaction) => filters.accountId === 'all' || transaction.accountId === filters.accountId)
    .filter((transaction) => filters.categoryId === 'all' || transaction.categoryId === filters.categoryId)
    .filter((transaction) => filters.kind === 'all' || transaction.kind === filters.kind)
    .filter((transaction) => filters.reviewStatus === 'all' || transaction.reviewStatus === filters.reviewStatus)
    .sort((a, b) => {
      const comparison = filters.sortBy === 'amount'
        ? a.amountMinor - b.amountMinor
        : a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      return filters.sortDirection === 'ascending' ? comparison : -comparison;
    });
}

export function toggleSelection(selected: Set<string>, id: string, isSelected: boolean) {
  const next = new Set(selected);
  if (isSelected) next.add(id);
  else next.delete(id);
  return next;
}
