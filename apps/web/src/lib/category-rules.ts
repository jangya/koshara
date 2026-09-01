export interface CategoryValidationInput {
  name: string;
  budgetMinor?: number | null;
}

interface ExistingCategory {
  id: string;
  name: string;
}

export interface CategoryValidationErrors {
  name?: string;
  budgetMinor?: string;
}

const nonSpendingCategoryNames = new Set(['income', 'transfer', 'investment']);

export function isBudgetEligibleCategory(name: string) {
  return !nonSpendingCategoryNames.has(name.trim().toLocaleLowerCase());
}

export function validateCategoryInput<T extends CategoryValidationInput>(
  input: T,
  categories: ExistingCategory[],
  currentId?: string,
): {value: T; errors: CategoryValidationErrors} {
  const value = {...input, name: input.name.trim()};
  const errors: CategoryValidationErrors = {};

  if (!value.name) errors.name = 'Enter a category name.';
  else if (categories.some((category) => category.id !== currentId && category.name.trim().toLocaleLowerCase() === value.name.toLocaleLowerCase())) {
    errors.name = 'A category with this name already exists.';
  }

  if (value.budgetMinor !== undefined && value.budgetMinor !== null) {
    if (!Number.isFinite(value.budgetMinor) || !Number.isInteger(value.budgetMinor)) {
      errors.budgetMinor = 'Monthly limit must be a valid INR amount.';
    } else if (value.budgetMinor < 0) {
      errors.budgetMinor = 'Monthly limit cannot be negative.';
    } else if (!isBudgetEligibleCategory(value.name)) {
      errors.budgetMinor = 'Monthly spending limits are not available for Income, Transfer, or Investment.';
    }
  }

  return {value, errors};
}

export type BudgetStatus = {
  label: 'On track' | 'Watch' | 'Near limit' | 'Over budget';
  percent: number;
  variant: 'success' | 'warning' | 'error';
};

export function getBudgetStatus(spendingMinor: number, budgetMinor: number): BudgetStatus {
  const rawPercent = budgetMinor === 0 ? (spendingMinor > 0 ? 101 : 0) : Math.round((spendingMinor / budgetMinor) * 100);
  if (spendingMinor > budgetMinor) return {label: 'Over budget', percent: rawPercent, variant: 'error'};
  if (rawPercent >= 90) return {label: 'Near limit', percent: rawPercent, variant: 'warning'};
  if (rawPercent >= 70) return {label: 'Watch', percent: rawPercent, variant: 'warning'};
  return {label: 'On track', percent: Math.max(0, rawPercent), variant: 'success'};
}
