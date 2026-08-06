import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import clientCoveragePolicy from '../config/client-coverage-policy.json';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      include: clientCoveragePolicy.coverageScope.include,
      exclude: clientCoveragePolicy.coverageScope.exclude,
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
