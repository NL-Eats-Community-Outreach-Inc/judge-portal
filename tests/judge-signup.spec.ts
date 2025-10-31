import { test, expect } from '@playwright/test';
import { uniqueTestEmail } from './test-utils/createUniqueEmail';
import { cleanupTestUserById, getUserIdByEmail } from './test-utils/deleteTestUser';

test.describe('Judge portal - sign-up & cleanup', () => {
  // One test user per test
  const user = { email: uniqueTestEmail(), password: 'UniqueTestPassphrase28940!' };

  test('Dashboard reached @judge', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Prepare to capture the signup response
    let createdUserId: string | undefined;

    // Click sign up and wait for navigation
    await page.getByRole('link', { name: 'Sign up' }).click();
    await page.waitForURL(/\/auth\/sign-up/, { timeout: 10000 });

    // Wait for form to be ready and fill it
    const emailInput = page.locator('input[id="email"]');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });

    await emailInput.fill(user.email);
    await page.locator('input[id="password"]').fill(user.password);
    await page.locator('input[id="repeat-password"]').fill(user.password);

    page.on('response', async (response) => {
      try {
        const url = response.url();
        // Supabase client will call /auth/v1/signup (or /auth/v1/token depending on flow)
        if (url.includes('/auth/v1/signup') && response.request().method() === 'POST') {
          const json = await response.json();
          // Different supabase client versions shape the response differently
          createdUserId = json?.data?.user?.id || json?.user?.id || json?.id || json?.data?.id;
        }
        // Sometimes the client posts to /auth/v1/token for magic links / sign in flows.
        if (url.includes('/auth/v1/token') && response.request().method() === 'POST') {
          const json = await response.json();
          createdUserId = createdUserId || json?.data?.user?.id || json?.user?.id || json?.id;
        }
      } catch {
        // Ignore JSON parse errors from unrelated responses
      }
    });

    await Promise.all([
      // Click triggers the signup network call
      page.getByRole('button', { name: 'Sign up' }).click(),
      // Wait for navigation to the judge dashboard (increased timeout for CI)
      page.waitForURL(/\/judge/, { timeout: 60000 }),
    ]);

    // If we didn't capture the id from the network, fallback to admin lookup by email
    if (!createdUserId) {
      try {
        createdUserId = await getUserIdByEmail(user.email);
      } catch (err) {
        console.error('[test] Failed to resolve user id by email', err);
      }
    }

    // Attach to testInfo so afterEach can clean up
    if (createdUserId) {
      (testInfo.project as any).testUserId = createdUserId;
    } else {
      console.warn(
        '[test] Could not capture createdUserId; cleanup may fail and will try fallback.'
      );
    }

    await expect(page).toHaveURL(/\/judge/);
  });

  test.afterEach(async ({}, testInfo) => {
    const testUserId = (testInfo.project as any).testUserId;
    if (testUserId) {
      try {
        await cleanupTestUserById(testUserId);
      } catch (err) {
        console.error('[afterEach] Cleanup failed:', err);
        // Don't fail the test if cleanup fails
      }
    }
  });
});
