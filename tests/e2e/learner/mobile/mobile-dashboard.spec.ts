import { test, expect, mobileContextFor } from '../../support/fixtures';

test.describe('Mobile learner dashboard', () => {
  test('displays the dashboard correctly on mobile', async ({ browser }) => {
    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto('/learner');

      await expect(page.getByRole('heading', { name: 'My Learning' })).toBeVisible();

      await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible();

      await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();

      await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();

      await expect(page.getByRole('link', { name: 'Learning', exact: true })).toBeVisible();

      await expect(page.getByRole('button', { name: 'Open search' })).toBeVisible();

      await expect(page.getByText('Loading your courses...')).toHaveCount(0);

      const errorMessage = page.getByText(/^Error loading courses:/);
      await expect(errorMessage).toHaveCount(0);

      const courseCards = page.locator('a[href^="/learner/courses/"]');
      const emptyState = page.getByRole('heading', {
        name: 'No courses yet',
      });

      await expect
        .poll(async () => {
          return (await courseCards.count()) > 0 || (await emptyState.isVisible());
        })
        .toBe(true);

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );

      expect(hasHorizontalOverflow).toBe(false);
    } finally {
      await context.close();
    }
  });
});
