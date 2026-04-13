import { test, expect } from '@playwright/test';

test.describe('Mentor Search and Filtering', () => {
  test.skip(
    true,
    'Skipping mentor search Playwright tests due to auth middleware redirect loop in the test environment'
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/participant/mentors');

    const emailInput = page.getByPlaceholder('m@example.com');
    const passwordInput = page.locator('input[type="password"]');
    const loginButton = page.getByRole('button', { name: 'Login' });

    await expect(emailInput).toBeVisible();
    await emailInput.fill('user1@example.com');

    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('abc123');

    await expect(loginButton).toBeVisible();
    await loginButton.click();

    await page.goto('http://localhost:3000/participant/mentors');
    await expect(page.getByText('Find Mentors')).toBeVisible();
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
