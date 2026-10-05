import {describe, expect, it} from 'vitest';

import type {Category} from '@/lib/koshara-types';
import {parseExpense} from './parse-expense';

const dining: Category = {id: 'dining', name: 'Dining', color: 'orange', budgetMinor: null};

describe('parseExpense', () => {
  it('prefills a relative local date, rupees, and a known category', () => {
    expect(parseExpense('Spend 500 rupees on dining yesterday', [dining], new Date(2026, 8, 24, 10))).toEqual({
      amount: 500,
      date: '2026-09-23',
      categoryId: 'dining',
      description: 'Dining',
    });
  });

  it('accepts a rupee symbol and an explicit date', () => {
    expect(parseExpense('Paid ₹ 1,250.50 at Cafe on 2026-09-12', [dining], new Date(2026, 8, 24))).toEqual({
      amount: 1250.5,
      date: '2026-09-12',
      categoryId: null,
      description: 'Cafe',
    });
  });

  it('leaves ambiguous details for the form', () => {
    expect(parseExpense('Add an expense', [dining], new Date(2026, 8, 24))).toEqual({
      amount: null,
      date: null,
      categoryId: null,
      description: '',
    });
  });
});
