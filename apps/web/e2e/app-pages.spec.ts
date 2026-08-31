import {expect, test} from '@playwright/test';

for (const path of ['/dashboard', '/transactions', '/categories']) {
  test(`${path} hydrates without a React mismatch`, async ({page}) => {
    const hydrationErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('Hydration failed')) {
        hydrationErrors.push(message.text());
      }
    });

    await page.goto(path);
    await expect(page.getByRole('heading', {level: 1})).toBeVisible();
    await expect(page.getByRole('button', {name: /Exact date range:/})).toBeVisible();

    expect(hydrationErrors).toEqual([]);
  });
}

test('keeps Categories prompts in the WebMCP pill and exposes category search', async ({page}) => {
  await page.goto('/categories');

  await expect(page.getByRole('main').getByRole('heading', {name: 'Try with your AI agent'})).toHaveCount(0);
  await page.getByRole('button', {name: /WebMCP tools available/}).click();
  await expect(page.getByRole('heading', {name: 'Categories agent tools'})).toBeVisible();
  await expect(page.getByText('search_categories', {exact: true})).toBeVisible();

  await page.getByRole('button', {name: /Example agent prompts/}).click();
  await expect(page.getByText(/Compare category spending from/)).toBeVisible();
});
