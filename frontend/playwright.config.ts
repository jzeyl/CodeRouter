import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel:
      process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'America/Toronto',
    colorScheme: 'light',
  },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 15174 --strictPort --mode integration',
      url: 'http://127.0.0.1:15174',
      reuseExistingServer: false,
    },
  ],
})
