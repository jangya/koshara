import {expect, test} from '@playwright/test';

test('keeps registered expense and statement surfaces in the Workspace', async ({page}, testInfo) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto('/workspace');
  if (testInfo.project.name === 'mobile-chromium') {
    await page.getByRole('button', {name: 'Open navigation'}).click();
    await expect(page.getByRole('dialog', {name: 'Navigation'}).getByRole('link', {name: 'Workspace'})).toBeVisible();
    await page.getByRole('button', {name: 'Close navigation'}).click();
  } else {
    await expect(page.getByRole('navigation').getByRole('link', {name: 'Workspace'})).toBeVisible();
  }
  await expect(page.getByRole('heading', {name: 'Koshara Workspace'})).toBeVisible();
  await expect(page.getByRole('textbox', {name: 'Ask Kosara'})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('workspace-empty.png'), fullPage: true});

  await page.getByRole('textbox', {name: 'Ask Kosara'}).fill('Add an expense');
  await page.getByRole('button', {name: 'Go', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Add expense'})).toBeVisible();
  await expect(page.getByRole('textbox', {name: 'Description'})).toBeVisible();
  await expect(page).toHaveURL(/\/workspace$/);

  await page.getByRole('textbox', {name: 'Ask Kosara'}).fill('Upload my statement');
  await page.getByRole('button', {name: 'Go', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Import a PDF in this browser'})).toBeVisible();
  await expect(page.getByRole('textbox', {name: 'Ask Kosara'})).toBeVisible();
  await expect(page.getByRole('textbox', {name: 'Ask Kosara'})).toBeInViewport();
  await expect(page).toHaveURL(/\/workspace$/);
  expect(browserErrors).toEqual([]);
});

test('opens an expense on Enter and prefills known details', async ({page}) => {
  await page.goto('/workspace');
  await page.getByRole('textbox', {name: 'Ask Kosara'}).fill('Spend 500 rupees on dining yesterday');
  await expect(page.getByRole('heading', {name: 'Add expense'})).toHaveCount(0);
  await page.getByRole('textbox', {name: 'Ask Kosara'}).press('Enter');
  await expect(page.getByRole('heading', {name: 'Add expense'})).toBeVisible();
  await expect(page.getByRole('textbox', {name: 'Description'})).toHaveValue('Dining');
  await expect(page.getByRole('spinbutton', {name: 'Amount'})).toHaveValue('500');
  await expect(page.getByRole('button', {name: /Category/})).toContainText('Dining');
  const yesterday = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  await expect(page.getByRole('combobox', {name: 'Date Required'})).toHaveValue(yesterday);
  await page.getByRole('button', {name: 'Add expense', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Activity'})).toBeVisible();
  await expect(page.getByText(/₹500.*Dining/)).toBeVisible();
  await page.getByRole('textbox', {name: 'Ask Kosara'}).fill('Check expenses');
  await page.getByRole('button', {name: 'Go', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Expenses'})).toBeVisible();
});

test('keeps completed account actions in the Workspace activity log', async ({page}, testInfo) => {
  await page.goto('/workspace');
  await page.getByRole('textbox', {name: 'Ask Kosara'}).fill('Add an account');
  await expect(page.getByRole('heading', {name: 'Add account'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Go', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Add account'})).toBeVisible();
  await page.getByRole('textbox', {name: 'Account name'}).fill('HGPT account');
  await page.getByRole('button', {name: 'Add account', exact: true}).last().click();
  await expect(page.getByRole('heading', {name: 'Activity'})).toBeVisible();
  await expect(page.getByText('HGPT account added to your accounts.')).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('workspace-activity.png'), fullPage: true});
  await page.reload();
  await expect(page.getByText('HGPT account added to your accounts.')).toBeVisible();
  await page.getByRole('textbox', {name: 'Ask Kosara'}).fill('Check accounts');
  await expect(page.getByRole('heading', {name: 'Accounts', exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Go', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Accounts', exact: true})).toBeVisible();
  await expect(page.getByText('HGPT account', {exact: true})).toBeVisible();
});

test('shows the newest activity item first below the input', async ({page}) => {
  await page.goto('/workspace');
  const composer = page.getByRole('textbox', {name: 'Ask Kosara'});
  await composer.fill('Check expenses');
  await page.getByRole('button', {name: 'Go', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Expenses'})).toBeVisible();
  await composer.fill('Check accounts');
  await page.getByRole('button', {name: 'Go', exact: true}).click();

  const activity = page.getByLabel('Workspace activity');
  const items = activity.getByRole('list').first().locator(':scope > li');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0).getByRole('heading', {name: 'Accounts'})).toBeVisible();
  await expect(items.nth(1).getByRole('heading', {name: 'Expenses'})).toBeVisible();
  await expect(composer).toBeInViewport();

  await page.reload();
  const savedItems = page.getByLabel('Workspace activity').getByRole('list').first().locator(':scope > li');
  await expect(savedItems.nth(0).getByRole('heading', {name: 'Accounts'})).toBeVisible();
  await expect(savedItems.nth(1).getByRole('heading', {name: 'Expenses'})).toBeVisible();
});

test('renders requested widgets in activity and clears them', async ({page}, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/workspace');
  await page.getByRole('textbox', {name: 'Ask Kosara'}).fill('Show my spending summary over the last year');
  await expect(page.getByRole('heading', {name: 'Spending by category'})).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Cash flow'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Go', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Spending by category'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Cash flow'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Activity'})).toBeVisible();
  await expect(page.getByLabel('Workspace widgets')).toHaveCount(1);
  await page.getByLabel('Cash-flow chart view').getByText('Spending', {exact: true}).click();
  await expect(page.getByLabel('Chart legend').getByText('Income', {exact: true})).toHaveCount(0);
  await page.screenshot({path: testInfo.outputPath('workspace-widgets.png'), fullPage: true});

  await page.reload();
  await expect(page.getByRole('heading', {name: 'Spending by category'})).toBeVisible();
  await page.getByRole('button', {name: 'Clear activity'}).click();
  await expect(page.getByRole('heading', {name: 'Activity'})).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Cash flow'})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Activity'})).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('composes income and spending widgets from one request', async ({page}) => {
  await page.goto('/workspace');
  await page.getByRole('textbox', {name: 'Ask Kosara'}).fill('Show income and spending');
  await page.getByRole('button', {name: 'Go', exact: true}).click();
  const widgets = page.getByLabel('Workspace activity').getByLabel('Workspace widgets');
  await expect(widgets.getByText('Income', {exact: true}).first()).toBeVisible();
  await expect(widgets.getByText('Spending', {exact: true}).first()).toBeVisible();
  await expect(widgets.getByRole('heading', {name: 'Cash flow'})).toBeVisible();
});

test('filters category spending to Food and Rent in the Workspace', async ({page}) => {
  await page.goto('/workspace');
  await page.getByRole('textbox', {name: 'Ask Kosara'}).fill('Show spending by category only on Food and rent');
  await page.getByRole('button', {name: 'Go', exact: true}).click();
  const widgets = page.getByLabel('Workspace widgets');
  await expect(widgets.getByRole('heading', {name: 'Spending by category'})).toBeVisible();
  await expect(widgets.getByText('Filtered categories: Groceries, Dining, Rent')).toBeVisible();
  await expect(widgets.getByText('Shopping', {exact: true})).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Workspace widgets').getByText('Filtered categories: Groceries, Dining, Rent')).toBeVisible();
});

test('lists available components on slash and waits for submission', async ({page}, testInfo) => {
  await page.goto('/workspace');
  const composer = page.getByRole('textbox', {name: 'Ask Kosara'});
  await expect(page.getByText('Type / to see available components. Press Enter or Go to open one.')).toBeVisible();
  await composer.fill('/');
  const menu = page.getByLabel('Available components');
  await expect(menu.getByRole('heading', {name: 'Available components'})).toBeVisible();
  await expect(menu.getByText('/income · Income', {exact: true})).toBeVisible();
  await expect(menu.getByText('/spending-year · Spending over the last year', {exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Activity'})).toHaveCount(0);
  await page.screenshot({path: testInfo.outputPath('workspace-slash-menu.png'), fullPage: true});

  await composer.fill('/cash');
  await expect(menu.getByText('/cashflow · Cash flow', {exact: true})).toBeVisible();
  await expect(menu.getByText('/income · Income', {exact: true})).toHaveCount(0);
  await menu.getByText('/cashflow · Cash flow', {exact: true}).click();
  await expect(composer).toHaveValue('Show cash flow');
  await expect(page.getByRole('heading', {name: 'Cash flow'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Go', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Cash flow'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Activity'})).toBeVisible();
});

test('shows debounced previews and request responses in URL debug mode', async ({page}, testInfo) => {
  await page.goto('/workspace?debug=true');
  const composer = page.getByRole('textbox', {name: 'Ask Kosara'});
  const debug = page.getByLabel('Workspace debug');
  await composer.fill('Show cash flow');
  await expect(page.getByText('Ready to open: Show widget. Press Enter or Go.')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Cash flow'})).toHaveCount(0);
  await expect(debug.getByRole('heading', {name: /Debounced preview/})).toBeVisible();
  await page.getByRole('button', {name: 'Go', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Cash flow'})).toBeVisible();
  await expect(debug.getByRole('heading', {name: /API request/})).toBeVisible();
  await expect(debug.getByText('availableWidgets', {exact: false})).toBeVisible();
  await expect(debug).toContainText('add_expense');
  await expect(debug).toContainText('recent_transactions');
  await page.screenshot({path: testInfo.outputPath('workspace-debug.png'), fullPage: true});
  await debug.getByRole('button', {name: 'Clear debug log'}).click();
  await expect(debug.getByText('No requests yet.')).toBeVisible();
});
