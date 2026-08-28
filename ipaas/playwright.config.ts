import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Safe to parallelize: the shared session's access token defaults to a 1-hour TTL
  // (tokenManager.ts/AuthContext.tsx), well beyond this workflow's 30-minute job timeout, so it
  // can't expire mid-run and trigger concurrent workers racing to refresh the same (rotating)
  // refresh token. Revisit if the suite grows enough to approach that timeout.
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://preview-o2-dev.devant.dev',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'setup',
      testDir: './tests/e2e',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'wip',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
        launchOptions: {
          args: ['--incognito'],
        },
      },
      dependencies: ['setup'],
    },
  ],
  outputDir: 'test-results/',
});
