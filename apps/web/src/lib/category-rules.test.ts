import {describe, expect, it} from 'vitest';

import {getBudgetStatus, validateCategoryInput} from './category-rules';

describe('category validation', () => {
  const categories = [
    {id: 'dining', name: 'Dining'},
    {id: 'income', name: 'Income'},
  ];

  it('trims names and accepts an optional non-negative budget', () => {
    expect(validateCategoryInput({name: '  Travel  ', budgetMinor: 0}, categories)).toEqual({
      value: {name: 'Travel', budgetMinor: 0},
      errors: {},
    });
  });

  it('rejects blank and duplicate names case-insensitively', () => {
    expect(validateCategoryInput({name: '   '}, categories).errors.name).toBe('Enter a category name.');
    expect(validateCategoryInput({name: ' dining '}, categories).errors.name).toBe('A category with this name already exists.');
    expect(validateCategoryInput({name: ' dining '}, categories, 'dining').errors.name).toBeUndefined();
  });

  it('rejects negative or non-integer minor-unit budgets', () => {
    expect(validateCategoryInput({name: 'Travel', budgetMinor: -1}, categories).errors.budgetMinor).toBe('Monthly limit cannot be negative.');
    expect(validateCategoryInput({name: 'Travel', budgetMinor: 1.2}, categories).errors.budgetMinor).toBe('Monthly limit must be a valid INR amount.');
  });

  it('does not allow spending limits for non-spending categories', () => {
    expect(validateCategoryInput({name: 'Income', budgetMinor: 10_000}, categories, 'income').errors.budgetMinor).toBe(
      'Monthly spending limits are not available for Income, Transfer, or Investment.',
    );
  });
});

describe('budget status', () => {
  it('returns textual on-track, near-limit, and over-budget states', () => {
    expect(getBudgetStatus(7_000, 10_000)).toMatchObject({label: 'On track', percent: 70});
    expect(getBudgetStatus(8_300, 10_000)).toMatchObject({label: 'Near limit', percent: 83});
    expect(getBudgetStatus(10_001, 10_000)).toMatchObject({label: 'Over budget', percent: 100});
  });
});
