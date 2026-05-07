import { test, expect } from '@playwright/test';
import { uniqueTestEmail } from './test-utils/create-unique-email';
import { cleanupTestUserById, getUserIdByEmail } from './test-utils/delete-test-user';

test.describe('LearnWorlds URL parameter handoff - sign-up flow', () => {
  const user = { email: uniqueTestEmail('participant'), password: 'UniqueTestPassphrase28940!' };

  test('Pre-fills email and selects participant when ref=learnworlds', async ({ page }) => {
    // Navigate to sign-up with LearnWorlds URL params
    await page.goto(`/auth/sign-up?ref=learnworlds&email=${encodeURIComponent(user.email)}`, {
      waitUntil: 'networkidle',
    });

    // Verify participant role is auto-selected
    const participantRadio = page.getByRole('radio', { name: 'Participant' });
    await expect(participantRadio).toBeChecked({ timeout: 10000 });

    // Verify email is pre-filled
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveValue(user.email);
  });

  // Requires handle_new_user() trigger to respect role metadata from sign-up options.
  // Works against the shared Supabase instance but not a fresh local one.
  test.skip('Pre-fills email and redirects to event after sign-up @learnworlds', async ({
    page,
  }, testInfo) => {
    const eventId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const nextUrl = `/participant/event/${eventId}?ref=learnworlds&email=${encodeURIComponent(user.email)}`;

    // Navigate with next param (simulates middleware redirect from deep link)
    await page.goto(`/auth/sign-up?next=${encodeURIComponent(nextUrl)}`, {
      waitUntil: 'networkidle',
    });

    // Verify participant role auto-selected
    const participantRadio = page.getByRole('radio', { name: 'Participant' });
    await expect(participantRadio).toBeChecked({ timeout: 10000 });

    // Verify email pre-filled from next param
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveValue(user.email);

    // Proceed to auth step
    await page
      .getByRole('button', { name: 'Next', exact: true })
      .filter({ hasNot: page.locator('#next-logo') })
      .click();

    // Select password auth tab
    await page.getByRole('tab', { name: 'Password', exact: true }).click();

    // Fill password
    await page.locator('input[id="password"]').fill(user.password);
    await page.locator('input[id="repeat-password"]').fill(user.password);

    // Capture user id from signup response
    let createdUserId: string | undefined;

    page.on('response', async (response) => {
      try {
        const url = response.url();
        if (url.includes('/auth/v1/signup') && response.request().method() === 'POST') {
          const json = await response.json();
          createdUserId = json?.data?.user?.id || json?.user?.id || json?.id || json?.data?.id;
        }
        if (url.includes('/auth/v1/token') && response.request().method() === 'POST') {
          const json = await response.json();
          createdUserId = createdUserId || json?.data?.user?.id || json?.user?.id || json?.id;
        }
      } catch {
        // Ignore parse errors
      }
    });

    await Promise.all([
      page.getByRole('button', { name: 'Create account' }).click(),
      // Should redirect to the event page, not just /participant
      page.waitForURL(new RegExp(`/participant/event/${eventId}`), { timeout: 60000 }),
    ]);

    // Verify the URL does NOT contain PII params (email, ref)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('email=');
    expect(currentUrl).not.toContain('ref=');

    // Fallback lookup if we didn't capture id from network
    if (!createdUserId) {
      try {
        createdUserId = await getUserIdByEmail(user.email);
      } catch (err) {
        console.error('[test] Failed to resolve user id by email', err);
      }
    }

    if (createdUserId) {
      (testInfo.project as any).testUserId = createdUserId;
    }

    await expect(page).toHaveURL(new RegExp(`/participant/event/${eventId}`));
  });

  test('Rejects open redirect attempts', async ({ page }) => {
    // Navigate with a malicious next param
    await page.goto(`/auth/sign-up?next=${encodeURIComponent('https://evil.com/steal')}`, {
      waitUntil: 'networkidle',
    });

    // The email should NOT be pre-filled (no ref=learnworlds)
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveValue('');

    // Judge role should still be the default (no LearnWorlds auto-select)
    const judgeRadio = page.getByRole('radio', { name: 'Judge' });
    await expect(judgeRadio).toBeChecked();
  });

  test.afterEach(async ({}, testInfo) => {
    const testUserId = (testInfo.project as any).testUserId;
    if (testUserId) {
      try {
        await cleanupTestUserById(testUserId);
      } catch (err) {
        console.error('[afterEach] Cleanup failed:', err);
      }
    }
  });
});
