import { test, expect, mobileContextFor } from '../../support/fixtures';

test.describe('Mobile learner navigation', () => {
  test('displays the mobile bottom navigation', async ({ browser }) => {
    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto('/learner');

      const navigation = page.getByRole('navigation', {
        name: 'Mobile navigation',
      });

      await expect(navigation).toBeVisible();

      await expect(
        navigation.getByRole('link', {
          name: 'Home',
          exact: true,
        })
      ).toBeVisible();

      await expect(
        navigation.getByRole('link', {
          name: 'Learning',
          exact: true,
        })
      ).toBeVisible();

      await expect(
        navigation.getByRole('button', {
          name: 'Open search',
        })
      ).toBeVisible();

      await expect(page.locator('aside.w-16')).toBeHidden();

      await expect(page.locator('div.fixed.left-0.top-0.z-40 > aside')).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('navigates between dashboard and catalogue', async ({ browser }) => {
    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto('/learner');

      const navigation = page.getByRole('navigation', {
        name: 'Mobile navigation',
      });

      await navigation
        .getByRole('link', {
          name: 'Learning',
          exact: true,
        })
        .click();

      await expect(page).toHaveURL(/\/learner\/courses\/?$/);

      await expect(page.getByRole('heading', { name: 'All courses' })).toBeVisible();

      await navigation
        .getByRole('link', {
          name: 'Home',
          exact: true,
        })
        .click();

      await expect(page).toHaveURL(/\/learner\/?$/);

      await expect(page.getByRole('heading', { name: 'My Learning' })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('opens and closes the mobile search overlay', async ({ browser }) => {
    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto('/learner');

      const navigation = page.getByRole('navigation', {
        name: 'Mobile navigation',
      });

      await navigation
        .getByRole('button', {
          name: 'Open search',
        })
        .click();

      const dialog = page.getByRole('dialog', {
        name: 'Search',
      });

      await expect(dialog).toBeVisible();

      await expect(dialog.getByPlaceholder('Search courses...')).toBeVisible();

      await dialog
        .getByRole('button', {
          name: 'Close search',
        })
        .click();

      await expect(dialog).toBeHidden();

      // Search should also close using Escape.
      await navigation
        .getByRole('button', {
          name: 'Open search',
        })
        .click();

      await expect(dialog).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(dialog).toBeHidden();
    } finally {
      await context.close();
    }
  });
});
