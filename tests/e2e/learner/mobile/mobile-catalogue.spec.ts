import { test, expect, mobileContextFor } from '../../support/fixtures';

test.describe('Mobile learner catalogue', () => {
  test('displays the course catalogue correctly on mobile', async ({ browser }) => {
    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto('/learner/courses');

      await expect(page.getByRole('heading', { name: 'All courses' })).toBeVisible();

      await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();

      const courseCards = page.locator('a[href^="/learner/courses/"]');
      const emptyState = page.getByRole('heading', {
        name: 'No courses yet',
      });

      await expect
        .poll(async () => {
          return (await courseCards.count()) > 0 || (await emptyState.isVisible());
        })
        .toBe(true);

      if (await courseCards.count()) {
        await expect(courseCards.first()).toBeVisible();

        const firstCard = courseCards.first();
        const cardBox = await firstCard.boundingBox();

        expect(cardBox).not.toBeNull();
        expect(cardBox!.width).toBeLessThanOrEqual(393);
      }

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );

      expect(hasHorizontalOverflow).toBe(false);
    } finally {
      await context.close();
    }
  });

  test('can open a course from the mobile catalogue', async ({ browser }) => {
    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto('/learner/courses');

      const courseCards = page.locator('a[href^="/learner/courses/"]');

      await expect.poll(async () => courseCards.count()).toBeGreaterThan(0);

      await courseCards.first().click();

      await expect(page).toHaveURL(/\/learner\/courses\/[^/]+\/?$/);

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      await expect(page.getByRole('heading', { name: 'Course content' })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
