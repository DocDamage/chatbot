import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import clientCoveragePolicy from '../config/client-coverage-policy.json';

const isPagesBuild = process.env.GITHUB_PAGES === 'true';
const requestedRuntimeMode = process.env.VITE_RUNTIME_MODE?.trim();
const runtimeMode = requestedRuntimeMode || (isPagesBuild ? 'static-demo' : 'application');
const publicApiBaseUrl = process.env.VITE_PUBLIC_API_BASE_URL?.trim();

if (runtimeMode !== 'application' && runtimeMode !== 'static-demo') {
  throw new Error(`Unsupported VITE_RUNTIME_MODE: ${runtimeMode}`);
}

if (isPagesBuild && runtimeMode !== 'static-demo') {
  throw new Error('GitHub Pages builds must use VITE_RUNTIME_MODE=static-demo.');
}

if (runtimeMode === 'static-demo' && publicApiBaseUrl) {
  throw new Error('Static demo builds must not set VITE_PUBLIC_API_BASE_URL.');
}

export default defineConfig({
  base: isPagesBuild ? '/chatbot/' : '/',
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: clientCoveragePolicy.coverageScope.include,
      exclude: clientCoveragePolicy.coverageScope.exclude,
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
