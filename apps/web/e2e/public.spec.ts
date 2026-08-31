import {expect, test} from '@playwright/test';

test('presents the human and AI WebMCP experiences on the landing page', async ({page}) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Koshara');
  await expect(page.getByRole('heading', {name: 'Your household finances, ready for you and your AI.'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Try the demo'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Explore dashboard'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'A simple handoff between you, your AI, and Koshara.'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Two ways your AI can work with Koshara'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Understand your finances'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Import a statement'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Try the statement workflow'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Copy prompt'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'View prompt'})).toBeVisible();
  await expect(page.getByText(/Import the attached demo statement into Koshara/)).not.toBeVisible();

  await page.getByRole('button', {name: 'Copy prompt'}).click();

  await expect(page.getByRole('button', {name: 'Copied'})).toBeVisible();

  await page.getByRole('button', {name: 'View prompt'}).click();

  await expect(page.getByText(/Import the attached demo statement into Koshara/)).toBeVisible();
  await expect(page.getByRole('heading', {name: 'A dashboard for you. Structured capabilities for your AI.'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'For you', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'For your AI', exact: true})).toBeVisible();
});

test('keeps the landing page within the viewport', async ({page}) => {
  await page.goto('/');

  const viewport = page.viewportSize();
  const bodySize = await page.locator('body').evaluate((body) => ({
    width: body.scrollWidth,
    height: body.scrollHeight,
  }));

  expect(viewport).not.toBeNull();
  expect(bodySize.width).toBeLessThanOrEqual(viewport!.width);
  expect(bodySize.height).toBeGreaterThan(0);
});

test('aligns the landing navigation with the page content', async ({page}) => {
  await page.goto('/');

  const navigationBounds = await page.getByRole('navigation', {name: 'Koshara navigation'}).boundingBox();
  const heroContainer = page.locator('.landing-hero .landing-container');
  const heroContainerBounds = await heroContainer.boundingBox();
  const heroPaddingInlineStart = await heroContainer.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).paddingInlineStart),
  );
  const brandBounds = await page.getByRole('link', {name: 'Koshara'}).boundingBox();

  expect(navigationBounds).not.toBeNull();
  expect(heroContainerBounds).not.toBeNull();
  expect(brandBounds).not.toBeNull();
  expect(Math.abs(navigationBounds!.x - heroContainerBounds!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(navigationBounds!.width - heroContainerBounds!.width)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(brandBounds!.x - (heroContainerBounds!.x + heroPaddingInlineStart)),
  ).toBeLessThanOrEqual(1);
});

test('serves baseline browser security headers', async ({request}) => {
  const response = await request.get('/');

  expect(response.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
});
