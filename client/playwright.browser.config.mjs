import { defineConfig, devices } from '@playwright/test';

const port = 4180;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  testMatch: /\.browser\.pw\.mjs$/,
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  timeout: 75_000,
  expect: {
    timeout: 15_000,
  },
  outputDir: 'test-results/browser/artifacts',
  reporter: [
    ['line'],
    ['json', { outputFile: 'test-results/browser/results.json' }],
    ['html', { outputFolder: 'playwright-report/browser', open: 'never' }],
  ],
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    colorScheme: 'dark',
  },
  webServer: {
    command: 'node dist/server/index.js',
    cwd: '..',
    url: `${baseURL}/health/ready`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DEPLOYMENT_MODE: 'test',
      PORT: String(port),
      JWT_SECRET: 'browser-e2e-jwt-secret-with-at-least-32-characters',
      LLM_PROVIDER: 'template',
      USE_OLLAMA: 'false',
      USE_HUGGINGFACE: 'false',
      EMBEDDING_USE_TRANSFORMERS: 'false',
      ENABLE_RAG: 'false',
      RAG_PERSISTENCE: 'true',
      RAG_GENERATE_EMBEDDINGS: 'false',
      EAGER_KNOWLEDGE_LOAD: 'false',
      ENABLE_REDIS_CACHE: 'false',
      ENABLE_DISK_CACHE: 'false',
      ENABLE_MODEL_ROUTING: 'false',
      ENABLE_ENSEMBLE: 'false',
      ENABLE_SEMANTIC_CACHE: 'false',
      ENABLE_WEBSOCKET: 'false',
      ENABLE_TOOL_CALLING: 'false',
      ENABLE_BASH_EXECUTOR: 'false',
      ENABLE_LOCAL_TOOLS: 'true',
      LOCAL_EXECUTION_ENABLED: 'true',
      LOCAL_TOOL_RUNS_DIR: 'data/local-tool-runs/browser-e2e',
      ENABLE_FL_STUDIO_MCP: 'false',
      REQUEST_READY_TIMEOUT_MS: '30000',
      STARTUP_TIMEOUT_MS: '120000',
    },
  },
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: /mobile\.browser\.pw\.mjs$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testMatch: /mobile\.browser\.pw\.mjs$/,
      use: { ...devices['Pixel 5'] },
    },
  ],
});
