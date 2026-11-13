import { defineConfig, devices } from '@playwright/test'
if (process.env.VITE_SUPABASE_URL !== 'https://xktbqykxmfuuzepfnjns.supabase.co' || process.env.CC16_BACKEND_URL !== 'http://127.0.0.1:4196') throw new Error('CC16 isolated local backend required')
export default defineConfig({
  testDir: './e2e', testMatch: ['contracts-15.spec.ts', 'contracts-16.spec.ts'],
  workers: 1, retries: 0, timeout: 90_000, expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: 'artifacts/contracts-16/playwright.json' }]],
  outputDir: 'artifacts/contracts-16/playwright',
  use: { baseURL: 'http://127.0.0.1:4185', trace: 'off', video: 'off', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4185 --strictPort', url: 'http://127.0.0.1:4185', reuseExistingServer: false, timeout: 120_000 },
})
