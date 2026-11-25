import { test, expect, contextFor } from '../../../support/fixtures';

test.describe('Desktop learner navigation', () => {
  test('displays the desktop sidebar and navigation links', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');
    const page = await context.newPage();

    await page.setViewportSize({ width: 1440, height: 900 });

    try {
      await page.goto('/classroom/learner');

      const desktopSidebar = page.locator('div.fixed.left-0.top-0.z-40 > aside');

      await expect(desktopSidebar).toBeVisible();

      const navigation = desktopSidebar.getByRole('navigation', {
        name: 'Learner navigation',
      });

      await expect(
        navigation.getByRole('link', {
          name: 'Dashboard',
          exact: true,
        })
      ).toBeVisible();

      await expect(
        navigation.getByRole('link', {
          name: 'My Learning',
          exact: true,
        })
      ).toBeVisible();

      await expect(
        navigation.getByRole('link', {
          name: 'Dashboard',
          exact: true,
        })
      ).toHaveAttribute('href', '/classroom/learner');

      await expect(
        navigation.getByRole('link', {
          name: 'My Learning',
          exact: true,
        })
      ).toHaveAttribute('href', '/classroom/learner/courses');

      await expect(
        page.getByRole('navigation', {
          name: 'Learner mobile navigation',
        })
      ).toBeHidden();

      await expect(
        page.getByRole('navigation', {
          name: 'Learner tablet navigation',
        })
      ).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('can navigate between dashboard and course catalogue', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');
    const page = await context.newPage();

    await page.setViewportSize({ width: 1440, height: 900 });

    try {
      await page.goto('/classroom/learner');

      const desktopSidebar = page.locator('div.fixed.left-0.top-0.z-40 > aside');

      const navigation = desktopSidebar.getByRole('navigation', {
        name: 'Learner navigation',
      });

      await navigation
        .getByRole('link', {
          name: 'My Learning',
          exact: true,
        })
        .click();

      await expect(page).toHaveURL(/\/classroom\/learner\/courses\/?$/);

      await expect(page.getByRole('heading', { name: 'All courses' })).toBeVisible();

      await navigation
        .getByRole('link', {
          name: 'Dashboard',
          exact: true,
        })
        .click();

      await expect(page).toHaveURL(/\/classroom\/learner\/?$/);

      await expect(page.getByRole('heading', { name: 'My Learning' })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('keeps the desktop sidebar visible when navigating to a course', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');
    const page = await context.newPage();

    await page.setViewportSize({ width: 1440, height: 900 });

    try {
      await page.goto('/classroom/learner');

      const courseCards = page.locator('a[href^="/classroom/learner/courses/"]');

      await expect.poll(async () => courseCards.count()).toBeGreaterThan(0);

      await courseCards.first().click();

      await expect(page.getByRole('heading', { name: 'Course content' })).toBeVisible();

      const desktopSidebar = page.locator('div.fixed.left-0.top-0.z-40 > aside');

      await expect(desktopSidebar).toBeVisible();

      await expect(
        desktopSidebar.getByRole('navigation', {
          name: 'Learner navigation',
        })
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
