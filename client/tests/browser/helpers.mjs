import jsonwebtoken from 'jsonwebtoken';
import { expect } from '@playwright/test';

export const JWT_SECRET = 'browser-e2e-jwt-secret-with-at-least-32-characters';
export const TEST_USER_ID = 'browser-e2e-user';

export function createToken({ roles = ['developer'], expiresIn = '15m', userId = TEST_USER_ID } = {}) {
  return jsonwebtoken.sign(
    { userId, email: `${userId}@example.test`, roles },
    JWT_SECRET,
    { expiresIn },
  );
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function installAuthenticatedApi(page, options = {}) {
  const userId = options.userId || TEST_USER_ID;
  const token = options.token || createToken({ roles: options.roles || ['developer', 'admin'], userId });

  await page.context().setExtraHTTPHeaders({
    Authorization: `Bearer ${token}`,
  });

  await page.route('**/api/**', async route => {
    const request = route.request();
    const headers = {
      ...request.headers(),
      authorization: `Bearer ${token}`,
    };
    delete headers['content-length'];

    let postData = request.postData();
    const url = new URL(request.url());
    if (url.pathname === '/api/chat' && request.method() === 'POST' && postData) {
      const payload = JSON.parse(postData);
      postData = JSON.stringify({ ...payload, userId });
    }

    await route.continue({ headers, postData });
  });

  return { token, userId };
}

export async function openBuiltApplication(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AI Chatbot Hub' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'AI chat' })).toBeVisible();
}

export async function switchMode(page, label) {
  const trigger = page.locator('.mode-selector-button');
  await trigger.click();
  const listbox = page.getByRole('listbox', { name: 'Chat mode' });
  await expect(listbox).toBeVisible();
  await listbox.getByRole('option', { name: label, exact: false }).click();
  await expect(trigger).toContainText(label);
}

export async function sendChatMessage(page, text) {
  const responsePromise = page.waitForResponse(response =>
    response.url().endsWith('/api/chat') && response.request().method() === 'POST',
  );
  await page.locator('.assistant-input').fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const requestBody = response.request().postDataJSON();
  const payload = await response.json();
  await expect(page.locator('.assistant-message-assistant .assistant-message-text').last()).not.toContainText('Thinking...');
  await expect(page.locator('.assistant-message-assistant .assistant-message-text').last()).not.toContainText('encountered an error');
  return { requestBody, payload };
}
