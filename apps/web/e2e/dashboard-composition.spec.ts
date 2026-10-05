import {expect, test} from '@playwright/test';

test('creates, saves, reloads, and edits a dashboard draft', async ({page}) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('dashboard-test-initialized')) { localStorage.removeItem('koshara-dashboard-definitions:v1'); sessionStorage.setItem('dashboard-test-initialized', 'yes'); } });
  await page.goto('/dashboard');
  await expect(page.getByText('Create your dashboard')).toBeVisible();
  await expect(page.getByRole('textbox', {name: 'Dashboard name'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Monthly spending'}).click();
  await page.getByRole('button', {name: 'Add widget'}).click();
  await page.getByRole('button', {name: 'Monthly income'}).click();
  await expect(page.getByRole('status').getByText('Monthly income added. Save changes when ready.')).toBeVisible();
  await expect(page.getByText('Selected: Monthly income')).toHaveCount(0);
  await page.getByRole('button', {name: 'Add widget'}).click();
  await page.getByRole('button', {name: 'Recent transactions'}).click();
  await expect(page.locator('.dashboard-widget')).toHaveCount(3);
  await page.locator('.dashboard-widget').first().click();
  await expect(page.getByRole('checkbox', {name: 'Monthly spending widget'})).toBeChecked();
  await page.getByRole('button', {name: 'Rename dashboard'}).click();
  await page.getByRole('textbox', {name: 'Dashboard name'}).fill('Monthly Overview');
  await page.getByRole('button', {name: 'Save changes'}).click();
  await expect(page.getByRole('status').getByText('Dashboard saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Monthly Overview'})).toBeVisible();
  await expect(page.getByRole('textbox', {name: 'Dashboard name'})).toHaveCount(0);
  await expect(page.locator('.dashboard-widget')).toHaveCount(3);
  await page.route('**/api/dashboard-command', async (route) => {
    await route.fulfill({json: {decision: {
      action: 'remove_widget', widget: 'income', targetId: (JSON.parse(route.request().postData() ?? '{}').widgets as Array<{id: string; type: string}>).find(({type}) => type === 'income')?.id,
      anchorId: 'none', placement: 'none', size: 'unchanged', accountId: 'none', categoryId: 'none', dateRange: 'unchanged', sort: 'unchanged', transactionType: 'unchanged',
    }}});
  });
  await page.getByRole('textbox', {name: 'Dashboard request'}).fill('Remove income');
  await page.getByRole('button', {name: 'Apply'}).click();
  await expect(page.getByRole('status').getByText('Draft updated. Save changes when ready.')).toBeVisible();
  await expect(page.locator('.dashboard-widget')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.dashboard-widget')).toHaveCount(3);
});
