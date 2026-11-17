import { test, expect, mobileContextFor } from '../../support/fixtures';

test.describe('Global learner search', () => {
  test('opens the global search overlay', async ({ browser }) => {
    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto('/learner');

      const navigation = page.getByRole('navigation', {
        name: 'Mobile navigation',
      });

      await navigation.getByRole('button', { name: 'Open search' }).click();

      const dialog = page.getByRole('dialog', {
        name: 'Search',
      });

      await expect(dialog).toBeVisible();

      await expect(dialog.getByText('Find courses in My Learning.')).toBeVisible();

      await expect(
        dialog.getByRole('textbox', {
          name: 'Search courses...',
        })
      ).toBeVisible();

      await expect(dialog.getByText('Find your next learning opportunity')).toBeVisible();

      await expect(dialog.getByText('Start typing to search available courses.')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('finds courses by title', async ({ browser }) => {
    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto('/learner');

      const courseCards = page.locator('a[href^="/learner/courses/"]');

      await expect.poll(async () => courseCards.count()).toBeGreaterThan(0);

      const firstCourse = courseCards.first();
      const courseTitle = await firstCourse.locator('h3').innerText();

      await page
        .getByRole('navigation', {
          name: 'Mobile navigation',
        })
        .getByRole('button', {
          name: 'Open search',
        })
        .click();

      const dialog = page.getByRole('dialog', {
        name: 'Search',
      });

      const searchInput = dialog.getByRole('textbox', {
        name: 'Search courses...',
      });

      await searchInput.fill(courseTitle);

      const result = dialog.getByRole('link', {
        name: new RegExp(courseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      });

      await expect(result).toBeVisible();

      await expect(result.locator('h4')).toHaveText(courseTitle);

      await expect(dialog.getByRole('heading', { name: 'Courses' })).toBeVisible();

      await expect(dialog.getByText('1 result')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('filters results as the user types', async ({ browser }) => {
    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto('/learner');

      const courseCards = page.locator('a[href^="/learner/courses/"]');

      await expect.poll(async () => courseCards.count()).toBeGreaterThan(0);

      const firstTitle = await courseCards.first().locator('h3').innerText();

      await page
        .getByRole('navigation', {
          name: 'Mobile navigation',
        })
        .getByRole('button', {
          name: 'Open search',
        })
        .click();

      const dialog = page.getByRole('dialog', {
        name: 'Search',
      });

      const searchInput = dialog.getByRole('textbox', {
        name: 'Search courses...',
      });

      await searchInput.fill(firstTitle);

      await expect(dialog.getByRole('link')).toHaveCount(1);

      await searchInput.fill('zzzz-no-match-847291');

      await expect(dialog.getByText('No matching courses')).toBeVisible();

      await expect(dialog.getByText('Try a different course title or keyword.')).toBeVisible();

      await expect(dialog.getByRole('link')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('clears the search and restores the initial state', async ({ browser }) => {
    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto('/learner');

      const navigation = page.getByRole('navigation', {
        name: 'Mobile navigation',
      });

      await navigation.getByRole('button', { name: 'Open search' }).click();

      const dialog = page.getByRole('dialog', {
        name: 'Search',
      });

      const searchInput = dialog.getByRole('textbox', {
        name: 'Search courses...',
      });

      await searchInput.fill('zzzz-no-match-847291');

      await expect(dialog.getByText('No matching courses')).toBeVisible();

      await dialog
        .getByRole('button', {
          name: 'Clear search',
        })
        .click();

      await expect(searchInput).toHaveValue('');

      await expect(dialog.getByText('Find your next learning opportunity')).toBeVisible();

      await expect(dialog.getByText('Start typing to search available courses.')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('navigates to a course from global search results', async ({ browser }) => {
    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto('/learner');

      const courseCards = page.locator('a[href^="/learner/courses/"]');

      await expect.poll(async () => courseCards.count()).toBeGreaterThan(0);

      const firstCourse = courseCards.first();

      const courseTitle = await firstCourse.locator('h3').innerText();
      const courseHref = await firstCourse.getAttribute('href');

      expect(courseHref).toBeTruthy();

      await page
        .getByRole('navigation', {
          name: 'Mobile navigation',
        })
        .getByRole('button', {
          name: 'Open search',
        })
        .click();

      const dialog = page.getByRole('dialog', {
        name: 'Search',
      });

      await dialog
        .getByRole('textbox', {
          name: 'Search courses...',
        })
        .fill(courseTitle);

      const result = dialog.getByRole('link', {
        name: new RegExp(courseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      });

      await expect(result).toBeVisible();

      await result.click();

      await expect(page).toHaveURL(
        new RegExp(`${courseHref!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`)
      );

      await expect(
        page.getByRole('heading', {
          name: 'Course content',
        })
      ).toBeVisible();

      await expect(
        page.getByRole('dialog', {
          name: 'Search',
        })
      ).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('closes using the close button and Escape key', async ({ browser }) => {
    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto('/learner');

      const navigation = page.getByRole('navigation', {
        name: 'Mobile navigation',
      });

      const openSearchButton = navigation.getByRole('button', {
        name: 'Open search',
      });

      await openSearchButton.click();

      const dialog = page.getByRole('dialog', {
        name: 'Search',
      });

      await expect(dialog).toBeVisible();

      await dialog
        .getByRole('button', {
          name: 'Close search',
        })
        .click();

      await expect(dialog).toBeHidden();

      await openSearchButton.click();

      await expect(dialog).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(dialog).toBeHidden();
    } finally {
      await context.close();
    }
  });
});
