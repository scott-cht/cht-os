import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.INTEGRATION_BASE_URL || 'http://localhost:3000',
    extraHTTPHeaders: process.env.INTERNAL_API_KEY
      ? { 'x-api-key': process.env.INTERNAL_API_KEY }
      : {},
  },
});
