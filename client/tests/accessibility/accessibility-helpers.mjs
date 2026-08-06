import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

const settingsPayload = {
  settings: {},
  secrets: {},
  status: {
    activeProvider: 'template',
    configured: {},
    model: 'template',
  },
};

export async function mockApplicationApi(page) {
  await page.route('**/health/ready', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ready"}' });
  });

  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/settings') {
      const body = request.method() === 'PUT'
        ? { ...settingsPayload, status: { ...settingsPayload.status, activeProvider: 'template' } }
        : settingsPayload;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      return;
    }

    if (url.pathname === '/api/chat' && request.method() === 'POST') {
      await new Promise(resolve => setTimeout(resolve, 150));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ artifactId: 'assistant-a11y', response: 'Accessible response ready.' }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'FIXTURE_UNAVAILABLE', message: 'Not part of this accessibility fixture.' } }),
    });
  });
}

export async function expectNoAxeViolations(page, stateName) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();

  const summary = results.violations.map(violation => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map(node => node.target),
  }));

  expect(summary, `${stateName} must have no Axe violations`).toEqual([]);
}
