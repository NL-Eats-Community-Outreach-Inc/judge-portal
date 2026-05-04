import { test, expect } from '@playwright/test';
import { uniqueTestEmail } from './test-utils/create-unique-email';
import { cleanupTestUserById, getUserIdByEmail } from './test-utils/delete-test-user';

test.describe('Mentor Search and Filtering', () => {
  let createdUserId: string | undefined;

  test.beforeEach(async ({ page }) => {
    const user = {
      email: uniqueTestEmail('participant'),
      password: 'UniqueTestPassphrase28940!',
    };

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Sign up' }).click();
    await page.waitForURL(/\/auth\/sign-up/, { timeout: 10000 });

    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Participant').check();
    await emailInput.fill(user.email);

    await page
      .getByRole('button', { name: 'Next', exact: true })
      .filter({ hasNot: page.locator('#next-logo') })
      .click();

    await page.getByRole('tab', { name: 'Password', exact: true }).click();
    await page.locator('input[id="password"]').fill(user.password);
    await page.locator('input[id="repeat-password"]').fill(user.password);

    await Promise.all([
      page.getByRole('button', { name: 'Create account' }).click(),
      page.waitForURL(/\/participant/, { timeout: 60000 }),
    ]);

    try {
      createdUserId = await getUserIdByEmail(user.email);
    } catch {
      createdUserId = undefined;
    }

    await page.goto('/participant/mentors', { waitUntil: 'networkidle' });
    await page.waitForURL(/\/participant\/mentors(?:\?.*)?$/, { timeout: 30000 });
    await expect(page.getByText('Find Mentors')).toBeVisible();
  });

  test.afterEach(async () => {
    if (!createdUserId) return;
    try {
      await cleanupTestUserById(createdUserId);
    } catch {
      // best-effort
    } finally {
      createdUserId = undefined;
    }
  });

  test('page loads and shows mentors', async ({ page }) => {
    await expect(page.getByText('Find Mentors')).toBeVisible();
    await expect(page.getByText('Sarah Ahmed')).toBeVisible();
  });

  test('search filters mentors by name', async ({ page }) => {
    await page.getByPlaceholder('Search by name or company...').fill('Sarah');

    await expect(page.getByText('Sarah Ahmed')).toBeVisible();
    await expect(page.getByText('David Chen')).toHaveCount(0);
  });

  test('filter by expertise works', async ({ page }) => {
    await page.getByRole('button', { name: 'AI' }).first().click();

    await expect(page.getByText('David Chen')).toBeVisible();
    await expect(page.getByText('James Patel')).toBeVisible();
  });

  test('clear filters restores full list', async ({ page }) => {
    await page.getByRole('button', { name: 'AI' }).first().click();
    await page.getByText('Clear Filters').click();

    await expect(page.getByText('Sarah Ahmed')).toBeVisible();
    await expect(page.getByText('David Chen')).toBeVisible();
    await expect(page.getByText('Maria Gonzalez')).toBeVisible();
    await expect(page.getByText('James Patel')).toBeVisible();
  });
});
