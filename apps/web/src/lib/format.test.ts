import {describe, expect, it} from 'vitest';

import {formatMinorCurrency, formatMinorCurrencySummary, formatTransactionDate} from './format';

describe('financial display formatting', () => {
  it('formats signed minor units without losing paise', () => {
    expect(formatMinorCurrency(-125075, 'INR')).toBe('-₹1,250.75');
    expect(formatMinorCurrency(2500, 'INR')).toBe('₹25.00');
  });

  it('uses Indian grouping and omits unnecessary paise in summary values', () => {
    expect(formatMinorCurrencySummary(7_489_00, 'INR')).toBe('₹7,489');
    expect(formatMinorCurrencySummary(12_34_567_50, 'INR')).toBe('₹12,34,567.50');
  });

  it('formats date-only values without local timezone drift', () => {
    expect(formatTransactionDate('2026-02-01')).toBe('1 Feb 2026');
  });
});
