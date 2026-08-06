import { expect, test } from '@playwright/test';
import {
  installAuthenticatedApi,
  openBuiltApplication,
  sendChatMessage,
  switchMode,
} from './helpers.mjs';

test('mobile viewport loads the built application and completes a chat smoke workflow', async ({ page }) => {
  await installAuthenticatedApi(page, { roles: ['developer', 'admin'] });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await openBuiltApplication(page);
  expect(page.viewportSize()).toEqual({ width: 393, height: 851 });
  await expect(page.locator('.assistant-input')).toBeVisible();

  await switchMode(page, 'Explain');
  await expect(page.locator('.assistant-input')).toHaveAttribute('placeholder', 'What should I explain?');
  const { payload } = await sendChatMessage(page, 'Explain the P03-T05 mobile browser canary in one sentence.');
  expect(payload.response).toEqual(expect.any(String));
  await expect(page.getByRole('status')).toContainText('2 messages');
  expect(pageErrors).toEqual([]);
});
