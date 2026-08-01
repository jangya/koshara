import {expect, test} from '@playwright/test';

test('renders the credential-free landing page without financial sample data', async ({page}) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Koshara');
  await expect(page.getByRole('heading', {name: 'Every account. One household view.'})).toBeVisible();
  await expect(page.getByText('Authentication is not configured')).toBeVisible();
  await expect(page.getByText(/sample transaction/i)).toHaveCount(0);
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

test('serves baseline browser security headers', async ({request}) => {
  const response = await request.get('/');

  expect(response.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
});
