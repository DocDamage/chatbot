import { expect, test } from '@playwright/test';
import {
  authHeaders,
  installAuthenticatedApi,
  openBuiltApplication,
} from './helpers.mjs';

test('requires explicit approval before online knowledge ingestion', async ({ page }) => {
  await installAuthenticatedApi(page, { roles: ['developer', 'admin'] });
  let ingestCount = 0;
  let ingestBody;

  await page.route('**/api/knowledge-online/search', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        query: 'P03-T05 knowledge approval',
        domain: 'ask',
        retrievedAt: new Date().toISOString(),
        answerPreview: 'Controlled online preview for the browser approval boundary.',
        sources: [{
          title: 'Controlled browser source',
          url: 'https://example.test/p03-t05',
          snippet: 'External retrieval is mocked only at the HTTP boundary.',
        }],
        reviewToken: 'p03-t05-review-token',
        requiresApproval: true,
        sourcePolicy: { accepted: 1, rejected: [] },
      }),
    });
  });

  await page.route('**/api/knowledge-online/ingest', async route => {
    ingestCount += 1;
    ingestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, ingestedSources: 1, chunks: 1 }),
    });
  });

  await openBuiltApplication(page);
  const panel = page.getByRole('region', { name: 'Knowledge online' });
  await panel.getByPlaceholder('Question or search query').fill('P03-T05 knowledge approval');
  await panel.getByRole('button', { name: 'Search', exact: true }).click();

  await expect(panel.getByRole('heading', { name: 'Online preview' })).toBeVisible();
  expect(ingestCount).toBe(0);
  await panel.getByRole('button', { name: 'Ingest Current Preview' }).click();
  await expect.poll(() => ingestCount).toBe(1);
  expect(ingestBody.approved).toBe(true);
  expect(ingestBody.approvedBy).toBe('knowledge-panel');
  await expect(panel.getByRole('heading', { name: 'Ingestion result' })).toBeVisible();
});

test('plans, approves, and runs the safe local harness, then completes an internal Sprite Lab workflow', async ({ page, request }) => {
  const { token } = await installAuthenticatedApi(page, { roles: ['developer', 'admin'] });
  const planResponse = await request.post('/api/local-tools/run/plan', {
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    data: {
      executablePath: process.execPath,
      args: ['scripts/browser/local-tool-fixture.mjs', 'P03-T05-safe-run'],
      cwd: '.',
      riskLevel: 'low',
    },
  });
  expect(planResponse.status()).toBe(200);
  const plannedRun = await planResponse.json();
  expect(plannedRun.runId).toBeTruthy();
  expect(plannedRun.requiresApproval).toBe(true);

  await openBuiltApplication(page);
  const localPanel = page.getByRole('region', { name: 'Local run approvals' });
  const runCard = localPanel.locator('.local-run-card').filter({ hasText: 'local-tool-fixture.mjs' }).first();
  await expect(runCard).toBeVisible();
  await runCard.getByRole('button', { name: 'Select' }).click();
  await runCard.getByRole('button', { name: 'Approve' }).click();
  await expect(runCard).toContainText('Approved');
  await expect(runCard.getByRole('button', { name: 'Start' })).toBeEnabled();
  await runCard.getByRole('button', { name: 'Start' }).click();
  await expect(runCard).toContainText('completed');
  await expect(localPanel.locator('.local-run-output-text')).toContainText('P03-T05 safe local tool harness completed.');

  const spritePanel = page.getByRole('region', { name: 'Sprite Lab' });
  await spritePanel.getByLabel('Input path').fill('data/browser-e2e-fixtures/browser-e2e-sprite.png');
  await spritePanel.getByLabel('Output target').fill('data/browser-e2e-output/browser-e2e-sprite.manifest.json');
  await spritePanel.getByRole('button', { name: 'Plan Workflow' }).click();
  await expect(spritePanel.getByRole('heading', { name: 'Planned workflow' })).toBeVisible();
  await spritePanel.getByRole('button', { name: 'Generate Manifest' }).click();
  const result = spritePanel.getByRole('heading', { name: 'Action result' }).locator('..');
  await expect(result).toContainText('completed');
  await expect(result).toContainText('browser-e2e-sprite.manifest.json');
});
