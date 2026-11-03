import { test, expect, type Page } from '@playwright/test';
import { deleteUserByEmail } from '../support/supabase-admin';

function nextButton(page: Page) {
  return page.getByRole('button', { name: 'Next', exact: true });
}

function uniqueEmail(role: string) {
  return `qa-signup-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
}

test.describe('Sign-up (email and password)', () => {
  const password = 'UniqueTestPassphrase28940!';

  test('a participant signs up and lands on the participant dashboard', async ({ page }) => {
    const email = uniqueEmail('participant');

    try {
      await page.goto('/auth/sign-up');

      // Judge is selected by default. Deselect it and select Participant.
      await page.getByRole('button', { name: /Judge/ }).click();
      await page.getByRole('button', { name: /Participant/ }).click();

      await page.locator('#email-step1').fill(email);
      await nextButton(page).click();

      await expect(page.locator('#password')).toBeVisible();

      await page.locator('#password').fill(password);
      await page.locator('#repeat-password').fill(password);

      await page.getByRole('button', { name: 'Create account' }).click();

      await expect(page).toHaveURL(/\/participant(?:\/|$)/, {
        timeout: 60_000,
      });

      await expect(page.getByText('Innovation Hub').first()).toBeVisible();
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test('a judge signs up, selects an organization and lands on the judge dashboard', async ({
    page,
  }) => {
    const email = uniqueEmail('judge');

    try {
      await page.goto('/auth/sign-up');

      // Judge is already selected by default.
      await expect(page.getByRole('button', { name: /Judge/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      );

      await page.locator('#email-step1').fill(email);
      await nextButton(page).click();

      const organization = page.getByRole('button', {
        name: /QA Organization/,
      });

      await expect(organization).toBeVisible();
      await organization.click();

      await nextButton(page).click();

      await expect(page.locator('#password')).toBeVisible();

      await page.locator('#password').fill(password);
      await page.locator('#repeat-password').fill(password);

      await page.getByRole('button', { name: 'Create account' }).click();

      await expect(page).toHaveURL(/\/judge(?:\/|$)/, {
        timeout: 60_000,
      });

      const memberships = await page.request.get('/api/judge/organizations');

      expect(memberships.ok()).toBeTruthy();

      const body = (await memberships.json()) as {
        memberships: Array<{ orgName: string }>;
      };

      expect(body.memberships.map((membership) => membership.orgName)).toContain('QA Organization');
    } finally {
      await deleteUserByEmail(email);
    }
  });
});
