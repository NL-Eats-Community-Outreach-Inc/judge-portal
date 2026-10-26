import { test, expect, contextFor } from '../support/fixtures';

/**
 * Learner Dashboard — Smoke Tests
 *
 * Tests the learner dashboard, course navigation, and catalogue search.
 *
 * This test suite:
 * 1. Opens the learner dashboard and verifies it loads successfully.
 * 2. Checks that courses or the empty-catalogue state are displayed.
 * 3. Navigates to My Learning and verifies the course catalogue.
 * 4. Searches the catalogue and verifies the no-matching-courses state.
 *
 * Uses a saved learner authentication state; login is not tested here.
 */

test.describe('Learner dashboard @smoke', () => {
  /**
   * Opens the learner dashboard and verifies its initial state.
   */
  async function openDashboard(page: import('@playwright/test').Page) {
    // 1. Open the learner dashboard.
    await page.goto('/learner');

    // 2. Verify the learner navigation is visible.
    await expect(page.getByRole('link', { name: 'My Learning' }).first()).toBeVisible();

    // 3. Verify course loading has finished without errors.
    await expect(page.getByText('Loading your courses...')).toHaveCount(0);
    await expect(page.getByText(/^Error loading courses:/)).toHaveCount(0);

    // 4. Verify the dashboard heading is displayed.
    await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible();
  }

  test('learner can open the dashboard and navigate to My Learning', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');

    try {
      const page = await context.newPage();

      // 1. Open the dashboard and verify its initial state.
      await openDashboard(page);

      // 2. Verify courses or the empty-catalogue state are displayed.
      const courseCards = page.locator('a[href^="/learner/courses/"]');
      const emptyCatalogue = page.getByRole('heading', {
        name: 'No courses yet',
      });

      await expect(courseCards.first().or(emptyCatalogue)).toBeVisible();

      // 3. Navigate to My Learning.
      await page.getByRole('link', { name: 'My Learning' }).first().click();

      // 4. Verify the course catalogue page.
      await expect(page).toHaveURL(/\/learner\/courses\/?$/);
      await expect(page.getByRole('heading', { name: 'All courses' })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('learner can search the dashboard course catalogue', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');

    try {
      const page = await context.newPage();

      // 1. Open the dashboard and verify its initial state.
      await openDashboard(page);

      // 2. Skip the test if the catalogue is empty.
      const emptyCatalogue = page.getByRole('heading', {
        name: 'No courses yet',
      });

      if (await emptyCatalogue.isVisible()) {
        test.skip(true, 'Cannot test course search when the catalogue is empty.');
      }

      // 3. Search for a term that should not match any course.
      const search = page.getByRole('searchbox', {
        name: 'Search courses',
      });

      await expect(search).toBeVisible();
      await search.fill('e2e-no-match-847291');

      // 4. Verify the no-matching-courses state.
      await expect(page.getByRole('heading', { name: 'No matching courses' })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
