import { test, expect, contextFor } from '../../support/fixtures';

test.describe('Tablet learner navigation', () => {
  test('displays the compact tablet navigation rail', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');
    const page = await context.newPage();

    await page.setViewportSize({ width: 900, height: 900 });

    try {
      await page.goto('/learner');

      const tabletRail = page.locator('aside.w-16');

      await expect(tabletRail).toBeVisible();

      await expect(
        tabletRail.getByRole('navigation', {
          name: 'Tablet navigation',
        })
      ).toBeVisible();

      await expect(
        tabletRail.getByRole('button', {
          name: 'Expand navigation',
        })
      ).toBeVisible();

      await expect(page.locator('div.fixed.left-0.top-0.z-40 > aside')).toBeHidden();

      await expect(
        page.getByRole('navigation', {
          name: 'Mobile navigation',
        })
      ).toBeHidden();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );

      expect(hasHorizontalOverflow).toBe(false);
    } finally {
      await context.close();
    }
  });

  test('opens and closes the expanded tablet navigation', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');
    const page = await context.newPage();

    await page.setViewportSize({ width: 900, height: 900 });

    try {
      await page.goto('/learner');

      const tabletRail = page.locator('aside.w-16');

      await tabletRail
        .getByRole('button', {
          name: 'Expand navigation',
        })
        .click();

      const overlay = page.locator('div.fixed.inset-0.z-50').filter({
        has: page.locator('aside.w-64'),
      });

      await expect(overlay).toBeVisible();

      const expandedNavigation = overlay.getByRole('navigation', {
        name: 'Learner navigation',
      });

      await expect(
        expandedNavigation.getByRole('link', {
          name: 'Dashboard',
          exact: true,
        })
      ).toBeVisible();

      await expect(
        expandedNavigation.getByRole('link', {
          name: 'My Learning',
          exact: true,
        })
      ).toBeVisible();

      // Close using the backdrop button.
      await overlay
        .getByRole('button', {
          name: 'Close navigation',
        })
        .first()
        .click();

      await expect(overlay).toBeHidden();

      await expect(tabletRail).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('can navigate to the course catalogue using tablet navigation', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');
    const page = await context.newPage();

    await page.setViewportSize({ width: 900, height: 900 });

    try {
      await page.goto('/learner');

      const tabletRail = page.locator('aside.w-16');

      await tabletRail
        .getByRole('button', {
          name: 'Expand navigation',
        })
        .click();

      const overlay = page.locator('div.fixed.inset-0.z-50').filter({
        has: page.locator('aside.w-64'),
      });

      const expandedNavigation = overlay.getByRole('navigation', {
        name: 'Learner navigation',
      });

      await expandedNavigation
        .getByRole('link', {
          name: 'My Learning',
          exact: true,
        })
        .click();

      await expect(page).toHaveURL(/\/learner\/courses\/?$/);

      await expect(page.getByRole('heading', { name: 'All courses' })).toBeVisible();

      await expect(overlay).toBeHidden();

      await expect(tabletRail).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
