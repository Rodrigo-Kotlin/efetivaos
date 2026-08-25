import process from 'node:process'

import { defineConfig, devices } from '@playwright/test'

import { loadE2EEnv } from './e2e/env'

loadE2EEnv()

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173'
const hostname = new URL(baseURL).hostname
const isLocal = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]'

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results/playwright',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'authenticate',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], screenshot: 'off', trace: 'off', video: 'off' },
    },
    {
      name: 'chromium',
      testMatch: /(quotation-draft|comparison-flow|pricing-rules-flow|price-approval-admin|pricing-dashboard|crm-admin)\.spec\.ts/,
      dependencies: ['authenticate'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
    },
    {
      name: 'mobile-chromium',
      testMatch: /(quotation-mobile|price-list-mobile|crm-mobile)\.spec\.ts/,
      dependencies: ['chromium'],
      use: {
        ...devices['Pixel 7'],
        storageState: 'playwright/.auth/admin.json',
      },
    },
    {
      name: 'team-chromium',
      testMatch: /(pricing-rules-team|price-approval-team|crm-team)\.spec\.ts/,
      dependencies: ['chromium'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/team.json',
      },
    },
  ],
  webServer: isLocal
    ? {
        command: 'npm run preview -- --host 127.0.0.1',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
})
