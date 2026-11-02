import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  installAuthenticatedApi,
  openAdvancedWorkspace,
  openBuiltApplication,
} from './helpers.mjs';

test('coding history shows saved jobs and downloads a result', async ({ page }) => {
  await installAuthenticatedApi(page);
  const id = '51f342d0-2c92-4acf-9600-6c6b5435c6b1';
  // Deterministic UI fixture; owner isolation and real endpoint behavior have route/service tests.
  await page.route('**/api/code/tools/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/status')
      ? { enabled: true, installed: { aider: true }, model: 'fixture', workspaceRoot: 'fixture' }
      : pathname.endsWith('/jobs')
        ? { jobs: [{ id, tool: 'aider', status: 'completed', startedAt: '2026-11-01T10:00:00Z' }] }
        : { id, tool: 'aider', status: 'completed', result: { patch: { diff: 'fixture diff' } } };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  await openBuiltApplication(page);
  await openAdvancedWorkspace(page);
  await page.getByRole('button', { name: 'Coding workspace' }).click();
  await page.getByText('Coding job history', { exact: true }).click();
  await page.getByRole('button', { name: 'Refresh job history' }).click();
  const button = page.getByRole('button', { name: 'Download aider result' });
  await expect(button).toBeVisible();
  const pending = page.waitForEvent('download');
  await button.click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(`coding-job-${id}.json`);
  expect(JSON.parse(await fs.readFile(await download.path(), 'utf8'))).toMatchObject({
    id,
    result: { patch: { diff: 'fixture diff' } },
  });
});
