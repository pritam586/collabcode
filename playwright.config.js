import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production client build and a real server with an
// in-memory database. The Docker code runner is off, so these tests run JavaScript, which
// executes in the browser.
const SERVER_PORT = 4100;
const CLIENT_PORT = 5199;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Each browser parses the Monaco chunk and starts language workers, so a few at a time is plenty.
  workers: isCI ? 2 : 3,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: 'retain-on-failure',
    // Locally, use the installed Chrome instead of downloading Playwright's browser.
    channel: isCI ? undefined : 'chrome',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.js/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.js/ },
  ],
  webServer: [
    {
      command: 'npm --prefix server start',
      url: `http://localhost:${SERVER_PORT}/health`,
      reuseExistingServer: !isCI,
      env: {
        PORT: String(SERVER_PORT),
        NODE_ENV: 'test',
        DATABASE_PATH: ':memory:',
        LOG_LEVEL: 'warn',
        CODE_RUNNER_ENABLED: 'false',
        CLIENT_ORIGIN: `http://localhost:${CLIENT_PORT}`,
      },
    },
    {
      command: `npm --prefix client run build && npm --prefix client run preview -- --port ${CLIENT_PORT} --strictPort`,
      url: `http://localhost:${CLIENT_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 240_000,
      env: { VITE_SERVER_URL: `http://localhost:${SERVER_PORT}` },
    },
  ],
});
