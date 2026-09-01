import {describe, expect, it} from 'vitest';

import {
  aggregateTimeline,
  formatDateRange,
  getDateRangePreset,
  getPreviousPeriod,
  parseDateRangeParams,
} from './date-range';

describe('date range presets', () => {
  const now = new Date(2026, 7, 30, 9, 15);

  it('uses the elapsed local calendar month for this month', () => {
    expect(getDateRangePreset('this-month', now)).toEqual({start: '2026-08-01', end: '2026-08-30'});
  });

  it('returns complete calendar boundaries for previous month presets', () => {
    expect(getDateRangePreset('last-month', now)).toEqual({start: '2026-07-01', end: '2026-07-31'});
    expect(getDateRangePreset('last-3-months', now)).toEqual({start: '2026-06-01', end: '2026-08-30'});
    expect(getDateRangePreset('last-6-months', now)).toEqual({start: '2026-03-01', end: '2026-08-30'});
    expect(getDateRangePreset('year-to-date', now)).toEqual({start: '2026-01-01', end: '2026-08-30'});
  });

  it('compares against the immediately preceding inclusive period of equal length', () => {
    expect(getPreviousPeriod({start: '2026-08-01', end: '2026-08-30'})).toEqual({
      start: '2026-07-02',
      end: '2026-07-31',
    });
  });

  it('accepts valid URL ranges and falls back when values are incomplete or reversed', () => {
    expect(parseDateRangeParams(new URLSearchParams('from=2026-07-04&to=2026-08-09'), now)).toEqual({
      preset: 'custom',
      range: {start: '2026-07-04', end: '2026-08-09'},
    });
    expect(parseDateRangeParams(new URLSearchParams('from=2026-08-30&to=2026-08-01'), now)).toEqual({
      preset: 'this-month',
      range: {start: '2026-08-01', end: '2026-08-30'},
    });
  });

  it('formats exact periods without ambiguous preset-only text', () => {
    expect(formatDateRange({start: '2026-08-01', end: '2026-08-31'})).toBe('August 2026');
    expect(formatDateRange({start: '2026-08-01', end: '2026-08-30'})).toBe('1–30 August 2026');
    expect(formatDateRange({start: '2025-12-20', end: '2026-01-04'})).toBe('20 December 2025–4 January 2026');
  });
});

describe('timeline aggregation', () => {
  const transactions = [
    {date: '2026-08-01', kind: 'expense' as const, amountMinor: 12000},
    {date: '2026-08-01', kind: 'income' as const, amountMinor: 30000},
    {date: '2026-08-03', kind: 'expense' as const, amountMinor: 8000},
    {date: '2026-09-01', kind: 'income' as const, amountMinor: 50000},
  ];

  it('groups short ranges daily and fills dates without activity', () => {
    expect(aggregateTimeline(transactions, {start: '2026-08-01', end: '2026-08-03'})).toEqual([
      {key: '2026-08-01', label: '1 Aug', incomeMinor: 30000, spendingMinor: 12000},
      {key: '2026-08-02', label: '2 Aug', incomeMinor: 0, spendingMinor: 0},
      {key: '2026-08-03', label: '3 Aug', incomeMinor: 0, spendingMinor: 8000},
    ]);
  });

  it('groups ranges longer than 93 days by calendar month', () => {
    const points = aggregateTimeline(transactions, {start: '2026-05-01', end: '2026-09-30'});
    expect(points.map((point) => point.key)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(points[3]).toMatchObject({incomeMinor: 30000, spendingMinor: 20000});
    expect(points[4]).toMatchObject({incomeMinor: 50000, spendingMinor: 0});
  });
});
