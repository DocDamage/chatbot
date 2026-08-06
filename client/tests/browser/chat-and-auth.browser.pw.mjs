import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  authHeaders,
  createToken,
  installAuthenticatedApi,
  openBuiltApplication,
  sendChatMessage,
  switchMode,
  TEST_USER_ID,
} from './helpers.mjs';

test.describe.serial('built-server chat, authentication, and persistence', () => {
  test('enforces the login boundary and expires invalid sessions', async ({ request }) => {
    const unauthenticated = await request.get('/api/settings');
    expect(unauthenticated.status()).toBe(401);

    const ordinaryUser = createToken({ roles: ['user'] });
    const forbidden = await request.get('/api/settings', { headers: authHeaders(ordinaryUser) });
    expect(forbidden.status()).toBe(401);

    const expired = createToken({ roles: ['admin'], expiresIn: '-1s' });
    const expiredSession = await request.get('/api/settings', { headers: authHeaders(expired) });
    expect(expiredSession.status()).toBe(401);

    const admin = createToken({ roles: ['admin', 'developer'] });
    const authenticated = await request.get('/api/settings', { headers: authHeaders(admin) });
    expect(authenticated.status()).toBe(200);
    const settings = await authenticated.json();
    expect(settings.status.activeProvider).toBe('template');
    expect(settings.secrets.OPENAI_API_KEY).toEqual(expect.objectContaining({ configured: false }));
  });

  test('updates settings, switches modes, chats, streams, and reloads a persisted conversation', async ({ page, request }) => {
    test.setTimeout(180_000);
    const { token } = await installAuthenticatedApi(page, {
      roles: ['admin', 'developer'],
      userId: TEST_USER_ID,
    });
    await openBuiltApplication(page);
    await expect(page.getByRole('status')).toContainText('Connected');

    await page.getByRole('button', { name: 'Open settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Local fallback' }).click();
    const settingsResponse = page.waitForResponse(response =>
      response.url().endsWith('/api/settings')
      && response.request().method() === 'PUT',
    );
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    expect((await settingsResponse).status()).toBe(200);
    await expect(dialog.locator('.settings-message')).toContainText(
      'Saved. Active provider: template.',
      { timeout: 60_000 },
    );
    await dialog.getByRole('button', { name: 'Close settings' }).click();

    await switchMode(page, 'Plan');
    await expect(page.locator('.assistant-input')).toHaveAttribute('placeholder', 'Describe what you want to build...');
    await switchMode(page, 'Ask');

    const message = 'P03-T05 built-server chat canary';
    const { requestBody, payload } = await sendChatMessage(page, message);
    expect(requestBody.userId).toBe(TEST_USER_ID);
    expect(requestBody.sessionId).toBeTruthy();
    expect(payload.response).toEqual(expect.any(String));
    expect(payload.response.length).toBeGreaterThan(0);

    const streamResponse = await request.post('/api/v2/chat/stream', {
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      data: {
        message: 'P03-T05 streaming response canary',
        sessionId: randomUUID(),
        userId: TEST_USER_ID,
      },
    });
    expect(streamResponse.status()).toBe(200);
    expect(streamResponse.headers()['content-type']).toContain('text/event-stream');
    const streamBody = await streamResponse.text();
    expect(streamBody).toContain('"type":"connected"');
    expect(streamBody).toContain('"type":"chunk"');
    expect(streamBody).toContain('"type":"complete"');

    await page.reload();
    await openBuiltApplication(page);
    await page.getByRole('button', { name: /Conversation Tools/ }).click();
    await page.getByRole('button', { name: 'Refresh History' }).click();
    await expect(page.getByText('Conversation list refreshed')).toBeVisible();

    const historyResponse = await request.get('/api/conversations?limit=20', {
      headers: authHeaders(token),
    });
    expect(historyResponse.status()).toBe(200);
    const history = await historyResponse.json();
    const persisted = history.conversations.find(
      conversation => conversation.sessionId === requestBody.sessionId,
    );
    expect(persisted).toEqual(expect.objectContaining({
      firstMessage: message,
      userId: TEST_USER_ID,
    }));
    expect(persisted.messageCount).toBeGreaterThanOrEqual(2);

    const historyRow = page
      .getByRole('button', { name: `Delete ${requestBody.sessionId}` })
      .locator('..');
    await expect(historyRow).toContainText(message);
    await historyRow.locator('button').first().click();
    await expect(page.getByText('Conversation loaded')).toBeVisible();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
  });
});
