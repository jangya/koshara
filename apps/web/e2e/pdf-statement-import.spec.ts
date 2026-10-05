import {resolve} from 'node:path';
import {test, expect} from '@playwright/test';

test('parses a synthetic PDF locally and stages its rows in the existing review flow', async ({page}) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) browserErrors.push(message.text());
  });
  await page.goto('/statements');
  await page.getByRole('combobox', {name: /Import into account/}).click();
  await page.getByRole('option', {name: /ICICI/i}).click();
  await page.locator('input[type="file"]').setInputFiles(resolve('public/koshara_demo_credit_card_statement_june_2026.pdf'));
  await expect(page.getByText('20 transactions reconstructed')).toBeVisible();
  await expect(page.getByText('Statement reconciled')).toBeVisible();
  await expect(page.getByText('Payments / credits stated')).toBeVisible();
  await expect(page.getByText('Difference from rows')).toBeVisible();
  await page.getByRole('button', {name: 'Continue to statement review'}).click();
  await expect(page.getByRole('heading', {name: 'Import review'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Needs attention (20)'})).toBeVisible();
  await expect(page.getByText('CARD PAYMENT RECEIVED')).toBeVisible();
  await expect(page.getByText('Synthetic demo document for Koshara.', {exact: false})).toHaveCount(0);
  await page.getByRole('combobox', {name: 'Proposed category'}).first().click();
  await page.getByRole('option', {name: 'Shopping', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Needs attention (20)'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Ready (0)'})).toBeVisible();
  await page.getByRole('button', {name: 'Move to Ready'}).first().click();
  await expect(page.getByRole('button', {name: 'Ready (1)'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Needs attention (19)'})).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('koshara.finance.v1') ?? '');
  expect(stored).not.toContain('SYNTHETIC CREDIT CARD STATEMENT');
  expect(browserErrors).toEqual([]);
});

test('can cancel a staged PDF import and upload another statement', async ({page}) => {
  await page.goto('/statements');
  await page.getByRole('combobox', {name: /Import into account/}).click();
  await page.getByRole('option', {name: /ICICI/i}).click();
  const statement = resolve('public/koshara_demo_credit_card_statement_june_2026.pdf');
  await page.locator('input[type="file"]').setInputFiles(statement);
  await expect(page.getByText('20 transactions reconstructed')).toBeVisible();
  await page.getByRole('button', {name: 'Continue to statement review'}).click();
  await expect(page.getByRole('heading', {name: 'Import review'})).toBeVisible();

  await page.getByRole('button', {name: 'Cancel import'}).click();
  await expect(page.getByRole('alertdialog')).toContainText('Transactions already imported into Koshara will remain.');
  await page.getByRole('button', {name: 'Keep reviewing'}).click();
  await expect(page.getByRole('heading', {name: 'Import review'})).toBeVisible();

  await page.getByRole('button', {name: 'Cancel import'}).click();
  await page.getByRole('button', {name: 'Discard staged rows'}).click();
  await expect(page.getByRole('heading', {name: 'Import review'})).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('koshara.finance.v1') ?? ''))
    .not.toContain('koshara_demo_credit_card_statement_june_2026.pdf');
  await page.locator('input[type="file"]').setInputFiles(statement);
  await expect(page.getByText('20 transactions reconstructed')).toBeVisible();
});
