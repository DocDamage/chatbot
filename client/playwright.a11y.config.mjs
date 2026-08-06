import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/accessibility',
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: 'test-results/accessibility/artifacts',
  reporter: [
    ['line'],
    ['json', { outputFile: 'test-results/accessibility/results.json' }],
    ['html', { outputFolder: 'playwright-report/accessibility', open: 'never' }],
  ],
  use: {
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    colorScheme: 'dark',
  },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4175',
      url: 'http://127.0.0.1:4175',
      timeout: 120_000,
      reuseExistingServer: false,
      env: { VITE_RUNTIME_MODE: 'application' },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4176',
      url: 'http://127.0.0.1:4176',
      timeout: 120_000,
      reuseExistingServer: false,
      env: { VITE_RUNTIME_MODE: 'static-demo' },
    },
  ],
  projects: [
    {
      name: 'application-accessibility',
      testMatch: /application\.a11y\.pw\.mjs/,
      use: { baseURL: 'http://127.0.0.1:4175' },
    },
    {
      name: 'static-demo-accessibility',
      testMatch: /static-demo\.a11y\.pw\.mjs/,
      use: { baseURL: 'http://127.0.0.1:4176' },
    },
  ],
});
