import {describe, expect, it} from 'vitest';
import {buildHouseholdFinancialState, upcomingBills} from './dashboard-personalization';
import {createDemoState} from './koshara-seed';

const range = {start: '2026-09-01', end: '2026-09-23'} as const;

describe('dashboard financial facts', () => {
  it('derives compact facts from finance data', () => {
    const financial = buildHouseholdFinancialState(createDemoState(new Date(2026, 8, 23, 12)), range);
    expect(financial.incomeMinor).toBeGreaterThan(0);
    expect(financial.spendingMinor).toBeGreaterThan(0);
    expect(financial.topCategories.length).toBeLessThanOrEqual(3);
  });
  it('includes only bills due within the next 30 days', () => {
    const state = createDemoState(new Date(2026, 8, 23, 12));
    expect(upcomingBills(state, range.end)).toHaveLength(1);
    expect(upcomingBills(state, '2026-10-31')).toHaveLength(0);
  });
});
