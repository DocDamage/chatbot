const coveragePolicy = require('./config/server-coverage-policy.json');

const globalBaseline = coveragePolicy.baseline.global;
const coverageThreshold = globalBaseline
  ? {
      global: {
        branches: globalBaseline.branches.pct,
        functions: globalBaseline.functions.pct,
        lines: globalBaseline.lines.pct,
        statements: globalBaseline.statements.pct,
      },
    }
  : undefined;

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/e2e'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: coveragePolicy.coverageScope.collectCoverageFrom,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  ...(coverageThreshold ? { coverageThreshold } : {}),
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
  verbose: true,
};
