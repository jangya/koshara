import {expect, test} from '@playwright/test';
import {resolve} from 'node:path';

test('shows registered forms as the user types and keeps their actions in the composer', async ({page}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/workspace');
  const prompt = page.getByRole('textbox', {name: 'Ask Kosara'});
  const result = page.getByLabel('Workspace result in composer');
  await expect(prompt).toBeVisible();
  await expect(page.getByRole('button', {name: 'Send'})).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Activity'})).toHaveCount(0);
  const headingTop = await page.getByRole('heading', {name: 'Koshara Workspace'}).evaluate((element) => element.getBoundingClientRect().top);
  expect(headingTop).toBeLessThan(160);
  await page.screenshot({path: testInfo.outputPath('workspace-empty.png'), fullPage: true});

  await prompt.fill('Spend 500 rupees on dining yesterday');
  const expense = result.getByLabel('Expense form in composer');
  await expect(expense.getByRole('heading', {name: 'Add expense'})).toBeVisible();
  await expect(expense.getByRole('spinbutton', {name: 'Amount'})).toHaveValue('500');
  await expect(expense.getByRole('textbox', {name: 'Description'})).toHaveValue('Dining');
  const populatedHeadingTop = await page.getByRole('heading', {name: 'Koshara Workspace'}).evaluate((element) => element.getBoundingClientRect().top);
  expect(populatedHeadingTop).toBe(headingTop);
  await expense.getByRole('textbox', {name: 'Description'}).fill('Lunch with Priya');
  await page.screenshot({path: testInfo.outputPath('workspace-expense.png'), fullPage: true});
  await expense.getByRole('button', {name: 'Cancel'}).click();
  await expect(result).toHaveCount(0);

  await prompt.fill('Add an account');
  await expect(result.getByRole('heading', {name: 'Add account'})).toBeVisible();
  await result.getByRole('textbox', {name: 'Account name'}).fill('Workspace test account');
  await result.getByRole('button', {name: 'Add account', exact: true}).click();
  const activity = page.getByLabel('Workspace activity');
  await expect(activity.getByText('Workspace test account added to your accounts.')).toBeVisible();
  await expect(page.locator('.astryx-chat-composer').getByText('Workspace test account added to your accounts.')).toHaveCount(0);
  await prompt.fill('Check accounts');
  await expect(result.getByRole('heading', {name: 'Accounts', exact: true})).toBeVisible();
  await expect(result.getByText('Workspace test account', {exact: true})).toBeVisible();
  await expect(page).toHaveURL(/\/workspace$/);
  expect(errors).toEqual([]);
});

test('renders statement, table, and chart intents inside the composer without Enter', async ({page}, testInfo) => {
  await page.goto('/workspace');
  const prompt = page.getByRole('textbox', {name: 'Ask Kosara'});
  const result = page.getByLabel('Workspace result in composer');

  await prompt.fill('Upload my statement');
  await expect(result.getByRole('heading', {name: 'Import a PDF in this browser'})).toBeVisible();
  await prompt.fill('Check expenses');
  await expect(result.getByRole('heading', {name: 'Expenses'})).toBeVisible();
  await prompt.fill('Show spending by category only on Food and rent');
  const widgets = result.getByLabel('Workspace widgets');
  await expect(widgets.getByRole('heading', {name: 'Spending by category'})).toBeVisible();
  await expect(widgets.getByText('Filtered categories: Groceries, Dining, Rent')).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('workspace-widgets.png'), fullPage: true});
  await expect(page.getByRole('heading', {name: 'Activity'})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Send'})).toHaveCount(0);
});

test('opens the same command palette by typing slash or clicking below the composer', async ({page}, testInfo) => {
  await page.goto('/workspace');
  const prompt = page.getByRole('textbox', {name: 'Ask Kosara'});
  const palette = page.getByRole('dialog', {name: 'Workspace commands'});
  const slash = page.getByRole('button', {name: 'Open command palette'});
  await expect(slash).toBeVisible();
  await prompt.press('/');
  await expect(palette.getByRole('option', {name: '/cashflow · Cash flow'})).toBeVisible();
  await palette.getByRole('combobox', {name: 'Search workspace commands'}).press('Escape');
  await slash.click();
  await expect(palette).toBeVisible();
  await palette.getByRole('combobox', {name: 'Search workspace commands'}).fill('cash flow');
  await palette.getByRole('option', {name: '/cashflow · Cash flow'}).click();
  await expect(page.getByLabel('Workspace result in composer').getByRole('heading', {name: 'Cash flow'})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('workspace-command.png'), fullPage: true});
});

test('keeps the prompt compact as it grows and exposes live debug classifications', async ({page}) => {
  await page.goto('/workspace?debug=true');
  const prompt = page.getByRole('textbox', {name: 'Ask Kosara'});
  await prompt.fill('Show cash flow');
  await expect(page.getByLabel('Workspace result in composer').getByRole('heading', {name: 'Cash flow'})).toBeVisible();
  const debug = page.getByLabel('Workspace debug');
  await expect(debug.getByText('availableWidgets', {exact: false}).first()).toBeVisible();
  const height = await prompt.evaluate((element) => element.getBoundingClientRect().height);
  expect(height).toBeLessThan(100);
  const resultSize = await page.getByLabel('Workspace result in composer').evaluate((element) => ({
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(resultSize.height).toBeLessThan(500);
  expect(resultSize.scrollHeight).toBeGreaterThan(resultSize.height);
  await debug.getByRole('button', {name: 'Clear debug log'}).click();
  await expect(debug.getByText('No requests yet.')).toBeVisible();
});

test('saves an expense and exposes the remaining registered intents inline', async ({page}) => {
  await page.goto('/workspace');
  const prompt = page.getByRole('textbox', {name: 'Ask Kosara'});
  const result = page.getByLabel('Workspace result in composer');

  await prompt.fill('Spend 500 rupees on dining yesterday');
  await result.getByRole('button', {name: 'Save', exact: true}).click();
  await expect(page.getByLabel('Workspace activity').getByText(/₹500.*Dining/)).toBeVisible();
  await prompt.fill('Show transactions');
  await expect(result.getByRole('heading', {name: 'Transactions'})).toBeVisible();

  await prompt.fill('Add a category');
  await expect(result.getByRole('heading', {name: 'Add category'})).toBeVisible();
  await result.getByRole('button', {name: 'Cancel'}).click();
  await expect(result).toHaveCount(0);

  await prompt.fill('Build a dashboard');
  await expect(result.getByRole('heading', {name: 'Build dashboard'})).toBeVisible();
  await expect(result.getByRole('link', {name: 'Create new dashboard'})).toHaveAttribute('href', '/dashboard?new=1');
});

test('places a completed statement import in Activity below the composer', async ({page}, testInfo) => {
  await page.goto('/workspace');
  const prompt = page.getByRole('textbox', {name: 'Ask Kosara'});
  await prompt.fill('Upload my statement');
  const result = page.getByLabel('Workspace result in composer');
  await result.getByRole('combobox', {name: /Import into account/}).click();
  await page.getByRole('option', {name: /ICICI/i}).click();
  await result.locator('input[type="file"]').setInputFiles(resolve('public/koshara_demo_credit_card_statement_june_2026.pdf'));
  await expect(result.getByText('20 transactions reconstructed')).toBeVisible();
  await result.getByRole('button', {name: 'Continue to statement review'}).click();
  await expect(result.getByRole('heading', {name: 'Review statement'})).toBeVisible();
  await result.getByRole('button', {name: 'Move to Ready'}).first().click();
  await result.getByRole('button', {name: /Approve import \([1-9]/}).click();
  const activity = page.getByLabel('Workspace activity');
  await expect(activity.getByText(/transactions added from koshara_demo/)).toBeVisible();
  await expect(result).toHaveCount(0);
  await page.screenshot({path: testInfo.outputPath('workspace-statement-activity.png'), fullPage: true});
  await page.reload();
  await expect(page.getByLabel('Workspace activity').getByText(/transactions added from koshara_demo/)).toBeVisible();
});
