import { test, expect, type Page } from '@playwright/test';
import { deleteUserByEmail } from '../support/supabase-admin';

/**
 * Password sign-up for the two self-service roles. Each test creates one
 * throw-away account and removes it afterwards.
 */
/** The wizard's Next button (the dev overlay's own button is excluded). */
function nextButton(page: Page) {
  return page
    .getByRole('button', { name: 'Next', exact: true })
    .filter({ hasNot: page.locator('#next-logo') });
}

function uniqueEmail(role: string) {
  return `qa-signup-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
}

test.describe('Sign-up (password only)', () => {
  const password = 'UniqueTestPassphrase28940!';

  test('a participant signs up in two steps and lands on the participant dashboard', async ({
    page,
  }) => {
    const email = uniqueEmail('participant');
    try {
      await page.goto('/auth/login');
      await page.getByRole('link', { name: 'Sign up' }).click();
      await page.waitForURL(/\/auth\/sign-up/);
      await page.waitForLoadState('networkidle');

      await page.getByLabel('Participant').check();
      await page.getByLabel('Email').fill(email);
      await nextButton(page).click();

      // Password is the only method; no auth-method tab is offered
      await expect(page.getByRole('tab', { name: 'Passwordless' })).toHaveCount(0);
      await page.locator('#password').fill(password);
      await page.locator('#repeat-password').fill(password);
      await page.getByRole('button', { name: 'Create account' }).click();
      await page.waitForURL(/\/participant/, { timeout: 60_000 });
      await expect(page.getByText('Innovation Hub').first()).toBeVisible();
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test('a judge signs up in three steps, picks the organization and lands on the judge dashboard', async ({
    page,
  }) => {
    const email = uniqueEmail('judge');
    try {
      await page.goto('/auth/sign-up');
      await page.waitForLoadState('networkidle');
      await page.getByLabel('Judge').check();
      await page.getByLabel('Email').fill(email);
      await nextButton(page).click();

      await page.getByRole('button').filter({ hasText: 'QA Organization' }).click();
      await nextButton(page).click();

      await expect(page.getByRole('tab', { name: 'Passwordless' })).toHaveCount(0);
      await page.locator('#password').fill(password);
      await page.locator('#repeat-password').fill(password);
      await page.getByRole('button', { name: 'Create account' }).click();
      await page.waitForURL(/\/judge/, { timeout: 60_000 });

      // The new judge is a member of the chosen organization
      const memberships = await page.request.get('/api/judge/organizations');
      expect(memberships.ok()).toBeTruthy();
      const body = (await memberships.json()) as { memberships: Array<{ orgName: string }> };
      expect(body.memberships.map((m) => m.orgName)).toContain('QA Organization');
    } finally {
      await deleteUserByEmail(email);
    }
  });
});
