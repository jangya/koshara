import {expect, test} from '@playwright/test';

test('shows one finance workspace and ₹1,00,000 salary credits', async ({page}) => {
  await page.goto('/transactions?q=Salary');
  await expect(page.getByRole('heading', {name: 'Transactions'})).toBeVisible();
  await expect(page.getByRole('combobox', {name: 'Household'})).toHaveCount(0);
  await expect(page.getByText('Demo household')).toHaveCount(0);
  await expect(page.getByText('Salary credit').first()).toBeVisible();
  await expect(page.getByText('₹1,00,000').first()).toBeVisible();
});
