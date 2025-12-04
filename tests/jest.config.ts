import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '<rootDir>/api/**/*.test.ts',
    '<rootDir>/contracts/**/*.test.ts',
    '<rootDir>/e2e/**/*.test.ts',
  ],
  moduleNameMapper: {
    '^@fixtures/(.*)$': '<rootDir>/fixtures/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  collectCoverageFrom: [
    '../src/**/src/**/*.ts',
    '!../src/**/src/tests/**',
    '!../src/**/dist/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'json-summary'],
  maxWorkers: 4,
  // Run E2E tests sequentially
  projects: [
    {
      displayName: 'api',
      testMatch: ['<rootDir>/api/**/*.test.ts'],
      testEnvironment: 'node',
    },
    {
      displayName: 'contracts',
      testMatch: ['<rootDir>/contracts/**/*.test.ts'],
      testEnvironment: 'node',
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/e2e/**/*.test.ts'],
      testEnvironment: 'node',
      maxWorkers: 1, // Run E2E tests sequentially
    },
  ],
};

export default config;

