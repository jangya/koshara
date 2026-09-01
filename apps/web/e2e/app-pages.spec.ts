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

for (const path of ['/accounts', '/statements']) {
  test(`${path} hydrates without a React mismatch`, async ({page}) => {
    const hydrationErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('Hydration failed')) {
        hydrationErrors.push(message.text());
      }
    });

    await page.goto(path);
    await expect(page.getByRole('heading', {level: 1})).toBeVisible();

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

test('lets the Dashboard WebMCP tool configure and reset the visible cash-flow chart', async ({page}) => {
  await page.addInitScript(() => {
    type BrowserTool = {name: string; execute: (args: Record<string, unknown>) => unknown};
    const tools = new Map<string, BrowserTool>();
    Object.defineProperty(window, '__kosharaWebMcpTools', {value: tools});
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool: async (tool: BrowserTool, options?: {signal?: AbortSignal}) => {
          tools.set(tool.name, tool);
          options?.signal?.addEventListener('abort', () => tools.delete(tool.name), {once: true});
        },
      },
    });
  });
  await page.goto('/dashboard');

  await expect.poll(() => page.evaluate(() => {
    const tools = (window as unknown as {__kosharaWebMcpTools: Map<string, unknown>}).__kosharaWebMcpTools;
    return tools.has('configure_cashflow_chart');
  })).toBe(true);
  await page.evaluate(() => {
    const tools = (window as unknown as {__kosharaWebMcpTools: Map<string, {execute: (args: Record<string, unknown>) => unknown}>}).__kosharaWebMcpTools;
    return tools.get('configure_cashflow_chart')?.execute({
      mode: 'spending',
      grouping: 'monthly',
      dateRange: {from: '2026-06-01', to: '2026-08-31'},
      accountIds: ['icici-card'],
      categoryIds: [],
      comparePreviousPeriod: true,
      highlightedDates: ['2026-08-22'],
      highlightedCategoryIds: ['shopping'],
      insightTitle: 'Shopping drove the three-month increase',
    });
  });

  await expect(page.getByRole('heading', {name: 'Shopping drove the three-month increase'})).toBeVisible();
  await expect(page.getByText('Updated by your agent')).toBeVisible();
  await expect(page.getByText('Highlight: Shopping')).toBeVisible();
  await expect(page.getByText('Highlight: 22 Aug 2026')).toBeVisible();

  await page.getByRole('button', {name: 'Reset chart'}).click();
  await expect(page.getByRole('heading', {name: 'Cash flow'})).toBeVisible();
  await expect(page.getByText('Updated by your agent')).toHaveCount(0);

  await page.goto('/transactions');
  await expect.poll(() => page.evaluate(() => {
    const tools = (window as unknown as {__kosharaWebMcpTools: Map<string, unknown>}).__kosharaWebMcpTools;
    return tools.has('configure_cashflow_chart');
  })).toBe(false);
});
