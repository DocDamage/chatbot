import { expect, test } from '@playwright/test';
import {
  installAuthenticatedApi,
  openBuiltApplication,
} from './helpers.mjs';

test('surfaces readiness degradation and provider outage without a false success', async ({ page }) => {
  await installAuthenticatedApi(page, { roles: ['developer', 'admin'] });
  await page.route('**/health/ready', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'degraded', ready: false }),
  }));
  await page.route('**/api/chat', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Configured provider unavailable in controlled browser fixture' }),
  }));

  await openBuiltApplication(page);
  await expect(page.getByRole('status')).toContainText('Degraded');

  const failedResponse = page.waitForResponse(response => response.url().endsWith('/api/chat'));
  await page.locator('.assistant-input').fill('Trigger the controlled provider outage');
  await page.getByRole('button', { name: 'Send message' }).click();
  expect((await failedResponse).status()).toBe(503);
  await expect(page.locator('.assistant-message-assistant .assistant-message-text').last()).toContainText('encountered an error');
  await expect(page.locator('.assistant-message-assistant .assistant-message-text').last()).not.toContainText('success');
});
