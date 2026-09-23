import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

/**
 * End-to-end suite: `tests/e2e/**`, serial (one worker) against the test
 * database on `BASE_URL` (default http://localhost:3000). `global-setup.ts`
 * signs in the six role accounts once and saves their storage state; every
 * spec builds its own `QA-` event through the admin API and deletes it again.
 *
 * Run one spec: `npx playwright test tests/e2e/judge/scoring.spec.ts --project=chromium`
 * The `@smoke` subset: `npx playwright test --grep @smoke --project=chromium`
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'html',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
