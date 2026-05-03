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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const readHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

let isSchemaAvailable = true;

interface LearnerProgressRow {
  learnworlds_user_id: string;
  course_id: string;
  progress_percentage: number;
  completed_modules: number;
  completion_status: string;
  last_activity_timestamp: string | null;
  raw_payload_id: string | null;
}

async function fetchLearnerProgressRow(
  learnworldsUserId: string,
  courseId: string
): Promise<LearnerProgressRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/learner_progress?select=learnworlds_user_id,course_id,progress_percentage,completed_modules,completion_status,last_activity_timestamp,raw_payload_id&learnworlds_user_id=eq.${encodeURIComponent(learnworldsUserId)}&course_id=eq.${encodeURIComponent(courseId)}`,
    {
      method: 'GET',
      headers: readHeaders,
    }
  );

  if (!response.ok) {
    throw new Error(
      `[transform spec] Failed to read learner_progress row: ${await response.text()}`
    );
  }

  const rows = (await response.json()) as LearnerProgressRow[];
  return rows[0] ?? null;
}

async function fetchLearnerProgressRows(learnworldsUserId: string): Promise<LearnerProgressRow[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/learner_progress?select=learnworlds_user_id,course_id,progress_percentage,completed_modules,completion_status,last_activity_timestamp,raw_payload_id&learnworlds_user_id=eq.${encodeURIComponent(learnworldsUserId)}`,
    {
      method: 'GET',
      headers: readHeaders,
    }
  );

  if (!response.ok) {
    throw new Error(
      `[transform spec] Failed to read learner_progress rows by user: ${await response.text()}`
    );
  }

  return (await response.json()) as LearnerProgressRow[];
}

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

  test('computes completedModules using completed status with distinct module IDs', async ({
    page,
  }) => {
    test.skip(!isSchemaAvailable, 'LearnWorlds schema is not available in this environment');

    const uid = randomUUID().slice(0, 8);
    const email = uniqueTestEmail('judge');
    const userId = await createTestUser(email, TEST_PASSWORD, 'admin');
    const learnerExternalId = `test-learner-${uid}-modules`;
    const courseExternalId = `test-course-${uid}-modules`;

    const seeded = await seedTestSyncRun([
      {
        learnerExternalId,
        courseExternalId,
        moduleExternalId: `module-${uid}-a`,
        progressPercentage: 40,
        completionStatus: 'completed',
      },
      {
        learnerExternalId,
        courseExternalId,
        moduleExternalId: `module-${uid}-a`,
        progressPercentage: 45,
        completionStatus: 'completed',
      },
      {
        learnerExternalId,
        courseExternalId,
        moduleExternalId: `module-${uid}-b`,
        progressPercentage: 50,
        completionStatus: 'in_progress',
      },
      {
        learnerExternalId,
        courseExternalId,
        moduleExternalId: `module-${uid}-c`,
        progressPercentage: 100,
        completionStatus: 'completed',
      },
      {
        learnerExternalId,
        courseExternalId,
        moduleExternalId: null,
        progressPercentage: 100,
        completionStatus: 'completed',
      },
    ]);

    try {
      await login(page, email, TEST_PASSWORD, /\/admin/);

      const response = await page.request.post('/api/admin/learnworlds/transform', {
        data: { syncRunId: seeded.syncRunId },
      });

      expect(response.status()).toBe(200);
      const persisted = await fetchLearnerProgressRow(learnerExternalId, courseExternalId);
      expect(persisted).not.toBeNull();
      expect(persisted?.completed_modules).toBe(2);
    } finally {
      await cleanupTestSyncRun(seeded);
      await cleanupTestUserById(userId);
    }
  });

  test('upsert updates persisted fields for an existing learner+course row', async ({ page }) => {
    test.skip(!isSchemaAvailable, 'LearnWorlds schema is not available in this environment');

    const uid = randomUUID().slice(0, 8);
    const email = uniqueTestEmail('judge');
    const userId = await createTestUser(email, TEST_PASSWORD, 'admin');
    const learnerExternalId = `test-learner-${uid}-upsert`;
    const courseExternalId = `test-course-${uid}-upsert`;

    const firstSeed = await seedTestSyncRun([
      {
        learnerExternalId,
        courseExternalId,
        moduleExternalId: `module-${uid}-a`,
        progressPercentage: 20,
        completionStatus: 'in_progress',
      },
    ]);

    const secondSeed = await seedTestSyncRun([
      {
        learnerExternalId,
        courseExternalId,
        moduleExternalId: `module-${uid}-a`,
        progressPercentage: 100,
        completionStatus: 'completed',
      },
      {
        learnerExternalId,
        courseExternalId,
        moduleExternalId: `module-${uid}-b`,
        progressPercentage: 100,
        completionStatus: 'completed',
      },
    ]);

    try {
      await login(page, email, TEST_PASSWORD, /\/admin/);

      const firstRun = await page.request.post('/api/admin/learnworlds/transform', {
        data: { syncRunId: firstSeed.syncRunId },
      });
      expect(firstRun.status()).toBe(200);

      const firstPersisted = await fetchLearnerProgressRow(learnerExternalId, courseExternalId);
      expect(firstPersisted).not.toBeNull();
      expect(firstPersisted?.progress_percentage).toBe(20);
      expect(firstPersisted?.completed_modules).toBe(0);
      expect(firstPersisted?.completion_status).toBe('in_progress');

      const secondRun = await page.request.post('/api/admin/learnworlds/transform', {
        data: { syncRunId: secondSeed.syncRunId },
      });
      expect(secondRun.status()).toBe(200);

      const secondPersisted = await fetchLearnerProgressRow(learnerExternalId, courseExternalId);
      expect(secondPersisted).not.toBeNull();
      expect(secondPersisted?.progress_percentage).toBe(100);
      expect(secondPersisted?.completed_modules).toBe(2);
      expect(secondPersisted?.completion_status).toBe('completed');
      expect(secondPersisted?.raw_payload_id).not.toBeNull();
    } finally {
      await cleanupTestSyncRun(secondSeed);
      await cleanupTestSyncRun(firstSeed);
      await cleanupTestUserById(userId);
    }
  });

  test('persists separate rows for same learner across different courses', async ({ page }) => {
    test.skip(!isSchemaAvailable, 'LearnWorlds schema is not available in this environment');

    const uid = randomUUID().slice(0, 8);
    const email = uniqueTestEmail('judge');
    const userId = await createTestUser(email, TEST_PASSWORD, 'admin');
    const learnerExternalId = `test-learner-${uid}-multi-course`;

    const seeded = await seedTestSyncRun([
      {
        learnerExternalId,
        courseExternalId: `test-course-${uid}-c1`,
        moduleExternalId: `module-${uid}-a`,
        progressPercentage: 70,
        completionStatus: 'completed',
      },
      {
        learnerExternalId,
        courseExternalId: `test-course-${uid}-c2`,
        moduleExternalId: `module-${uid}-b`,
        progressPercentage: 10,
        completionStatus: 'in_progress',
      },
    ]);

    try {
      await login(page, email, TEST_PASSWORD, /\/admin/);

      const response = await page.request.post('/api/admin/learnworlds/transform', {
        data: { syncRunId: seeded.syncRunId },
      });

      expect(response.status()).toBe(200);

      const rows = await fetchLearnerProgressRows(learnerExternalId);
      expect(rows).toHaveLength(2);
      const courseIds = rows.map((row) => row.course_id).sort();
      expect(courseIds).toEqual([`test-course-${uid}-c1`, `test-course-${uid}-c2`]);
    } finally {
      await cleanupTestSyncRun(seeded);
      await cleanupTestUserById(userId);
    }
  });
});
