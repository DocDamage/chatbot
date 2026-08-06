import { expect, test } from '@playwright/test';
import {
  installAuthenticatedApi,
  openBuiltApplication,
  switchMode,
} from './helpers.mjs';

test('loads real workspace text and audio fixtures into chat context', async ({ page }) => {
  await installAuthenticatedApi(page, { roles: ['developer', 'admin'] });
  await openBuiltApplication(page);

  const fileExplorer = page.getByRole('complementary', { name: 'Workspace files' });
  const fileSearch = fileExplorer.getByPlaceholder('Search files');
  await fileSearch.fill('browser-e2e-note');
  await fileSearch.press('Enter');

  const noteResult = fileExplorer.getByRole('button', { name: /browser-e2e-note\.txt/ }).first();
  await expect(noteResult).toBeVisible();
  await noteResult.click();

  const preview = page.getByRole('region', { name: 'File preview' });
  await expect(preview).toContainText('P03-T05 built-server browser E2E fixture.');
  await preview.getByRole('button', { name: 'Load' }).click();
  await expect(page.getByLabel('Loaded chat context')).toContainText('browser-e2e-note.txt');

  await switchMode(page, 'Music');
  const audioBrowser = page.getByRole('region', { name: 'Audio browser' });
  await audioBrowser.getByPlaceholder('Search samples').fill('browser-e2e-tone');
  await audioBrowser.getByRole('button', { name: 'Search' }).click();

  const audioRow = audioBrowser.locator('.audio-file-row').filter({ hasText: 'browser-e2e-tone.wav' });
  await expect(audioRow).toBeVisible();
  await audioRow.getByRole('button', { name: 'browser-e2e-tone.wav' }).click();
  await expect(audioBrowser.locator('audio')).toHaveAttribute('src', /\/api\/audio\/preview\?path=/);
  await audioRow.getByRole('button', { name: 'Load' }).click();
  await expect(page.getByLabel('Loaded chat context')).toContainText('browser-e2e-tone.wav');
});
