
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

/**
 * General E2E tests continue running in Chromium, Firefox, and WebKit.
 *
 * Classroom lifecycle:
 * 1. Teacher creates a course, module, lesson, and content blocks.
 * 2. Learner suite runs against that classroom in all three browsers.
 * 3. Teacher deletes the classroom.
 * 4. Learner access to the deleted classroom is verified.
 *
 * Playwright project dependencies control this order.
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
    // Existing E2E tests, excluding classroom lifecycle specs.
    {
      name: 'chromium',
      testIgnore: /classroom\/(learner|teacher)\//,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: /classroom\/(learner|teacher)\//,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: /classroom\/(learner|teacher)\//,
      use: { ...devices['Desktop Safari'] },
    },

    // STAGE 1: Teacher creates the classroom.
    {
      name: 'classroom-teacher-setup',
      testMatch: /classroom\/teacher\/setup\.spec\.ts/,
      teardown: 'classroom-teacher-delete',
      use: { ...devices['Desktop Chrome'] },
    },

    // STAGE 2: Learners test the classroom in all three browsers.
    {
      name: 'classroom-learner-chromium',
      testMatch: /classroom\/learner\/.*\.spec\.ts/,
      dependencies: ['classroom-teacher-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'classroom-learner-firefox',
      testMatch: /classroom\/learner\/.*\.spec\.ts/,
      dependencies: ['classroom-teacher-setup'],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'classroom-learner-webkit',
      testMatch: /classroom\/learner\/.*\.spec\.ts/,
      dependencies: ['classroom-teacher-setup'],
      use: { ...devices['Desktop Safari'] },
    },

    // STAGE 3: Teacher deletes the classroom and verifies learner access is revoked.
    {
      name: 'classroom-teacher-delete',
      testMatch: /classroom\/teacher\/delete-and-verify\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
