import { randomUUID } from 'crypto';
import { expect, test, type Page } from '@playwright/test';
import { uniqueTestEmail } from './test-utils/create-unique-email';
import { createTestUser } from './test-utils/create-test-user';
import { cleanupTestUserById } from './test-utils/delete-test-user';
import {
  seedTestSyncRun,
  cleanupTestSyncRun,
  isLearnworldsSchemaAvailable,
} from './test-utils/seed-test-sync-run';

const TEST_PASSWORD = 'UniqueTestPassphrase28940!';
const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

let isSchemaAvailable = true;

async function login(page: Page, email: string, password: string, expectedPath: RegExp) {
  await page.goto('/auth/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.locator('#password').fill(password);

  await Promise.all([
    page.getByRole('button', { name: 'Login', exact: true }).click(),
    page.waitForURL(expectedPath, { timeout: 30000 }),
  ]);
}

test.describe('POST /api/admin/learnworlds/transform', () => {
  test.beforeAll(async () => {
    isSchemaAvailable = await isLearnworldsSchemaAvailable();
  });

  // ── Auth guard tests (no DB setup required) ─────────────────────────────

  test('redirects unauthenticated request to login', async ({ request }) => {
    const response = await request.post('/api/admin/learnworlds/transform', {
      maxRedirects: 0,
    });

    expect([302, 303, 307, 308]).toContain(response.status());
    const location = response.headers()['location'];
    expect(location).toContain('/auth/login');
  });

  test('returns 401 for authenticated non-admin user', async ({ page }) => {
    const email = uniqueTestEmail('judge');
    const userId = await createTestUser(email, TEST_PASSWORD, 'judge');

    try {
      await login(page, email, TEST_PASSWORD, /\/judge/);

      const response = await page.request.post('/api/admin/learnworlds/transform', {
        data: { syncRunId: NON_EXISTENT_UUID },
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    } finally {
      await cleanupTestUserById(userId);
    }
  });

  // ── Input validation tests ────────────────────────────────────────────────

  test('returns 400 when syncRunId is missing from the request body', async ({ page }) => {
    const email = uniqueTestEmail('judge');
    const userId = await createTestUser(email, TEST_PASSWORD, 'admin');

    try {
      await login(page, email, TEST_PASSWORD, /\/admin/);

      const response = await page.request.post('/api/admin/learnworlds/transform', {
        data: {},
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toMatch(/syncRunId/i);
    } finally {
      await cleanupTestUserById(userId);
    }
  });

  test('returns 404 when syncRunId does not exist in the database', async ({ page }) => {
    const email = uniqueTestEmail('judge');
    const userId = await createTestUser(email, TEST_PASSWORD, 'admin');

    try {
      await login(page, email, TEST_PASSWORD, /\/admin/);

      const response = await page.request.post('/api/admin/learnworlds/transform', {
        data: { syncRunId: NON_EXISTENT_UUID },
      });

      const body = await response.json();

      if (!isSchemaAvailable) {
        expect(response.status()).toBe(503);
        expect(body.error).toMatch(/schema is unavailable/i);
        return;
      }

      expect(response.status()).toBe(404);
      expect(typeof body.error).toBe('string');
    } finally {
      await cleanupTestUserById(userId);
    }
  });

  // ── Integration tests (seed real DB rows, then exercise the endpoint) ────

  test('transforms valid raw payloads and skips invalid ones', async ({ page }) => {
    test.skip(!isSchemaAvailable, 'LearnWorlds schema is not available in this environment');

    const uid = randomUUID().slice(0, 8);
    const email = uniqueTestEmail('judge');
    const userId = await createTestUser(email, TEST_PASSWORD, 'admin');

    const seeded = await seedTestSyncRun([
      {
        learnerExternalId: `test-learner-${uid}-a`,
        courseExternalId: `test-course-${uid}-x`,
        progressPercentage: 75,
        completionStatus: 'in_progress',
      },
      {
        learnerExternalId: `test-learner-${uid}-b`,
        courseExternalId: `test-course-${uid}-x`,
        progressPercentage: 100,
        completionStatus: 'completed',
      },
      {
        // invalid: learnerExternalId is null — must be skipped by the pipeline
        learnerExternalId: null,
        courseExternalId: `test-course-${uid}-x`,
        progressPercentage: 50,
        completionStatus: 'in_progress',
      },
    ]);

    try {
      await login(page, email, TEST_PASSWORD, /\/admin/);

      const response = await page.request.post('/api/admin/learnworlds/transform', {
        data: { syncRunId: seeded.syncRunId },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.syncRunId).toBe(seeded.syncRunId);
      expect(body.processedRecords).toBe(3);
      expect(body.persistedRecords).toBe(2);
      expect(body.skippedRecords).toBe(1);
    } finally {
      await cleanupTestSyncRun(seeded);
      await cleanupTestUserById(userId);
    }
  });

  test('is idempotent: running transform twice produces the same counts', async ({ page }) => {
    test.skip(!isSchemaAvailable, 'LearnWorlds schema is not available in this environment');

    const uid = randomUUID().slice(0, 8);
    const email = uniqueTestEmail('judge');
    const userId = await createTestUser(email, TEST_PASSWORD, 'admin');

    const seeded = await seedTestSyncRun([
      {
        learnerExternalId: `test-learner-${uid}-c`,
        courseExternalId: `test-course-${uid}-y`,
        progressPercentage: 60,
        completionStatus: 'in_progress',
      },
    ]);

    try {
      await login(page, email, TEST_PASSWORD, /\/admin/);

      const first = await page.request.post('/api/admin/learnworlds/transform', {
        data: { syncRunId: seeded.syncRunId },
      });
      const second = await page.request.post('/api/admin/learnworlds/transform', {
        data: { syncRunId: seeded.syncRunId },
      });

      expect(first.status()).toBe(200);
      expect(second.status()).toBe(200);

      const firstBody = await first.json();
      const secondBody = await second.json();

      // First run: one record persisted
      expect(firstBody.processedRecords).toBe(1);
      expect(firstBody.persistedRecords).toBe(1);
      expect(firstBody.skippedRecords).toBe(0);

      // Second run: same counts — upsert must not create duplicates
      expect(secondBody.processedRecords).toBe(1);
      expect(secondBody.persistedRecords).toBe(1);
      expect(secondBody.skippedRecords).toBe(0);
    } finally {
      await cleanupTestSyncRun(seeded);
      await cleanupTestUserById(userId);
    }
  });
});
