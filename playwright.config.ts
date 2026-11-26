import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || '5173';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
// A new database file per run, under the ignored data/ folder.
const DATABASE_PATH = `data/e2e/run-${Date.now()}-${process.pid}.sqlite`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['json']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NODE_ENV: 'test', DATABASE_PATH, PORT },
  },
});
