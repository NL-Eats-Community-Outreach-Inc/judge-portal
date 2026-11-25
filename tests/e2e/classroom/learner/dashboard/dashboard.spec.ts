import { test, expect, contextFor } from '../../../support/fixtures';

test.describe('Learner dashboard @smoke', () => {
  test('learner can open the dashboard and view available courses', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');

    try {
      const page = await context.newPage();

      await page.goto('/classroom/learner');

      // Verify learner navigation is visible.
      await expect(page.getByRole('link', { name: 'My Learning' }).first()).toBeVisible();

      // Verify course loading has finished without errors.
      await expect(page.getByText('Loading your courses...')).toHaveCount(0);
      await expect(page.getByText(/^Error loading courses:/)).toHaveCount(0);

      // Verify dashboard heading.
      await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible();

      // Verify courses or the empty-catalogue state.
      const courseCards = page.locator('a[href^="/classroom/learner/courses/"]');
      const emptyCatalogue = page.getByRole('heading', {
        name: 'No courses yet',
      });

      await expect(courseCards.first().or(emptyCatalogue)).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
