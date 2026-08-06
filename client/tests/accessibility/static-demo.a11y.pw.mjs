import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './accessibility-helpers.mjs';

test('static demo passes WCAG and color-contrast Axe rules in Chromium', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'AI Chatbot Hub' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Static interface demo only');
  await expect(page.getByLabel('Disabled chat composer')).toBeVisible();

  await expectNoAxeViolations(page, 'static demonstration');
});
