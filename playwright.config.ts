import { defineConfig, devices } from '@playwright/test';

const DEFAULT_APP_URL = process.env.APP_URL || 'http://127.0.0.1:5174';
process.env.APP_URL = DEFAULT_APP_URL;

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: DEFAULT_APP_URL,
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    timezoneId: 'Asia/Tokyo',
    locale: 'ja-JP',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: DEFAULT_APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      VITE_BYPASS_SUPABASE_AUTH: '1',
    },
  },
});
