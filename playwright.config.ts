import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['junit', { outputFile: 'test-results/results.xml' }], ['list']] : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Skip browser download in CI
        launchOptions: process.env.CI ? { 
          args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        } : {}
      },
    },
  ],
});
