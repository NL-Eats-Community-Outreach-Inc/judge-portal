import { test, expect, contextFor } from '../../../support/fixtures';

test.describe('Learner dashboard search', () => {
  test('learner can search the dashboard course catalogue', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');

    try {
      const page = await context.newPage();

      await page.goto('/classroom/learner');

      // Wait for the dashboard to finish loading.
      await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible();

      await expect(page.getByText('Loading your courses...')).toHaveCount(0);
      await expect(page.getByText(/^Error loading courses:/)).toHaveCount(0);

      // Skip if there are no courses available to search.
      const emptyCatalogue = page.getByRole('heading', {
        name: 'No courses yet',
      });

      if (await emptyCatalogue.isVisible()) {
        test.skip(true, 'Cannot test course search when the catalogue is empty.');
      }

      // Locate the actual dashboard search input.
      const search = page.getByRole('textbox', {
        name: 'Search courses...',
      });

      await expect(search).toBeVisible();

      // Search for a term that should not match any course.
      await search.fill('e2e-no-match-847291');

      // Verify the no-matching-courses state.
      await expect(page.getByRole('heading', { name: 'No matching courses' })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
