import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, mockApplicationApi } from './accessibility-helpers.mjs';

test.beforeEach(async ({ page }) => {
  await mockApplicationApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Chatbot' })).toBeVisible();
});

test('application shell and primary chat workflow pass Axe', async ({ page }) => {
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('region', { name: 'AI chat' })).toBeVisible();
  await expect(page.locator('.assistant-viewport')).toHaveAttribute('tabindex', '0');
  await expectNoAxeViolations(page, 'application shell');
});

test('keyboard-only mode selection exposes the selected mode accessibly', async ({ page }) => {
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Open advanced workspace' }).click();

  const modeButton = page.locator('.mode-selector-button');
  await modeButton.focus();
  await page.keyboard.press('ArrowDown');

  const listbox = page.getByRole('listbox', { name: 'Chat mode' });
  await expect(listbox).toBeVisible();
  await expect(page.getByRole('option', { name: /Ask/ })).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: /Plan/ })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(modeButton).toContainText('Plan');
  await expect(modeButton).toHaveAttribute('aria-expanded', 'false');
  await expectNoAxeViolations(page, 'keyboard-selected Plan mode');
});

test('settings dialog traps focus and restores the keyboard trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open settings' });
  await trigger.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close settings' })).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Save settings' })).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('expansion studios are keyboard reachable and pass Axe', async ({ page }) => {
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('button', { name: 'Open advanced workspace' }).click();

  await page.getByRole('button', { name: 'Expansion Studios' }).click();
  await expect(page.getByRole('region', { name: 'Expansion Studios workspace' })).toBeVisible();

  const writingTab = page.getByRole('tab', { name: 'Writing Studio' });
  await writingTab.focus();
  await page.keyboard.press('Enter');
  await expect(writingTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Open document' })).toBeDisabled();
  await expectNoAxeViolations(page, 'Expansion Studios workspace');
});

test('async chat completion is announced through the live status region', async ({ page }) => {
  const composer = page.getByPlaceholder('Ask a question...');
  await composer.fill('Run the accessibility fixture');
  await composer.press('Enter');

  await expect(page.getByText('Thinking...')).toBeVisible();
  await expect(page.getByText('Accessible response ready.')).toBeVisible();

  const liveStatus = page.locator('.status-bar[role="status"][aria-live="polite"]');
  await expect(liveStatus).toContainText('2 messages');
  await expectNoAxeViolations(page, 'completed asynchronous chat');
});
