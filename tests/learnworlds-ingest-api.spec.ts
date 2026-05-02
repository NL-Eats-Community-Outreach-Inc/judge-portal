import { expect, test, type Page } from '@playwright/test';
import { uniqueTestEmail } from './test-utils/create-unique-email';
import { createTestUser } from './test-utils/create-test-user';
import { cleanupTestUserById } from './test-utils/delete-test-user';

const TEST_PASSWORD = 'UniqueTestPassphrase28940!';

async function login(page: Page, email: string, password: string, expectedPath: RegExp) {
  await page.goto('/auth/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.locator('#password').fill(password);

  await Promise.all([
    page.getByRole('button', { name: 'Login', exact: true }).click(),
    page.waitForURL(expectedPath, { timeout: 30000 }),
  ]);
}

test.describe('POST /api/admin/learnworlds/ingest', () => {
  test('redirects unauthenticated request to login', async ({ request }) => {
    const response = await request.post('/api/admin/learnworlds/ingest', {
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

      const response = await page.request.post('/api/admin/learnworlds/ingest');
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    } finally {
      await cleanupTestUserById(userId);
    }
  });

  test('returns 400 for invalid trigger mode when admin', async ({ page }) => {
    const email = uniqueTestEmail('judge');
    const userId = await createTestUser(email, TEST_PASSWORD, 'admin');

    try {
      await login(page, email, TEST_PASSWORD, /\/admin/);

      const response = await page.request.post('/api/admin/learnworlds/ingest', {
        data: {
          triggerMode: 'invalid_mode',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid triggerMode value');
    } finally {
      await cleanupTestUserById(userId);
    }
  });

  test('returns controlled response for admin manual ingestion trigger', async ({ page }) => {
    const email = uniqueTestEmail('judge');
    const userId = await createTestUser(email, TEST_PASSWORD, 'admin');

    try {
      await login(page, email, TEST_PASSWORD, /\/admin/);

      const response = await page.request.post('/api/admin/learnworlds/ingest', {
        data: {
          triggerMode: 'manual',
        },
      });

      expect([200, 500, 502]).toContain(response.status());
      const body = await response.json();

      if (response.status() === 200) {
        expect(body.status).toBe('ok');
        expect(typeof body.syncRunId).toBe('string');
        expect(typeof body.totalRecords).toBe('number');
        expect(typeof body.validRecords).toBe('number');
        expect(typeof body.invalidRecords).toBe('number');
        expect(body.totalRecords).toBeGreaterThanOrEqual(body.validRecords);
        expect(body.validRecords).toBeGreaterThanOrEqual(0);
        expect(body.invalidRecords).toBe(body.totalRecords - body.validRecords);
      } else {
        expect(typeof body.error).toBe('string');
        expect(body.error.length).toBeGreaterThan(0);
      }
    } finally {
      await cleanupTestUserById(userId);
    }
  });
});
