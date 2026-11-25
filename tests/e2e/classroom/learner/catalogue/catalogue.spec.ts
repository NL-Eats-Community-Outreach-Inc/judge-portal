import { test, expect, contextFor } from '../../../support/fixtures';

test.describe('Learner course catalogue', () => {
  test('learner can navigate from the dashboard to My Learning', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');

    try {
      const page = await context.newPage();

      await page.goto('/classroom/learner');

      // Wait for the dashboard to load.
      await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible();

      await expect(page.getByText('Loading your courses...')).toHaveCount(0);
      await expect(page.getByText(/^Error loading courses:/)).toHaveCount(0);

      // Navigate to My Learning.
      await page.getByRole('link', { name: 'My Learning' }).first().click();

      // Verify the catalogue page.
      await expect(page).toHaveURL(/\/classroom\/learner\/courses\/?$/);

      await expect(page.getByRole('heading', { name: 'All courses' })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
