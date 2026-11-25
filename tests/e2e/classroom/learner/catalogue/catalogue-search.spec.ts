import { test, expect, contextFor } from '../../../support/fixtures';

test.describe('Learner catalogue search', () => {
  test('filters courses by title', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');
    const page = await context.newPage();

    try {
      await page.goto('/classroom/learner/courses');

      await expect(page.getByRole('heading', { name: 'All courses' })).toBeVisible();

      const searchInput = page.getByRole('searchbox', {
        name: 'Search all courses',
      });

      await expect(searchInput).toBeVisible();

      const courseCards = page.locator('a[href^="/classroom/learner/courses/"]');

      await expect.poll(async () => courseCards.count()).toBeGreaterThan(0);

      const firstCourseTitle = await courseCards.first().locator('h3').innerText();

      await searchInput.fill(firstCourseTitle);

      await expect(courseCards).toHaveCount(1);

      await expect(courseCards.first()).toContainText(firstCourseTitle);
    } finally {
      await context.close();
    }
  });

  test('updates results as the search query changes', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');
    const page = await context.newPage();

    try {
      await page.goto('/classroom/learner/courses');

      const searchInput = page.getByRole('searchbox', {
        name: 'Search all courses',
      });

      const courseCards = page.locator('a[href^="/classroom/learner/courses/"]');

      await expect.poll(async () => courseCards.count()).toBeGreaterThan(0);

      const firstCourseTitle = await courseCards.first().locator('h3').innerText();

      await searchInput.fill('zzzz-no-match-847291');

      await expect(
        page.getByRole('heading', {
          name: 'No matching courses',
        })
      ).toBeVisible();

      await expect(courseCards).toHaveCount(0);

      // Search for a course known to exist instead of assuming the seed data
      // contains a course with the literal word 'test' in its title.
      await searchInput.fill(firstCourseTitle);

      await expect.poll(async () => courseCards.count()).toBeGreaterThan(0);
      await expect(courseCards.first()).toContainText(firstCourseTitle);

      await expect(
        page.getByRole('heading', {
          name: 'No matching courses',
        })
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('clears the search using the keyboard', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');
    const page = await context.newPage();

    try {
      await page.goto('/classroom/learner/courses');

      const searchInput = page.getByRole('searchbox', {
        name: 'Search all courses',
      });

      const courseCards = page.locator('a[href^="/classroom/learner/courses/"]');

      await expect.poll(async () => courseCards.count()).toBeGreaterThan(0);

      await searchInput.fill('zzzz-no-match-847291');

      await expect(
        page.getByRole('heading', {
          name: 'No matching courses',
        })
      ).toBeVisible();

      await searchInput.focus();
      await searchInput.press('Control+A');
      await searchInput.press('Backspace');

      await expect(searchInput).toHaveValue('');

      await expect.poll(async () => courseCards.count()).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });

  test('shows an empty state when no courses match', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');
    const page = await context.newPage();

    try {
      await page.goto('/classroom/learner/courses');

      const searchInput = page.getByRole('searchbox', {
        name: 'Search all courses',
      });

      await searchInput.fill('zzzz-no-match-847291');

      await expect(
        page.getByRole('heading', {
          name: 'No matching courses',
        })
      ).toBeVisible();

      await expect(page.getByText('Try another search term.')).toBeVisible();

      await expect(page.locator('a[href^="/classroom/learner/courses/"]')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('opens a course from filtered search results', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');
    const page = await context.newPage();

    try {
      await page.goto('/classroom/learner/courses');

      const courseCards = page.locator('a[href^="/classroom/learner/courses/"]');

      await expect.poll(async () => courseCards.count()).toBeGreaterThan(0);

      const firstCourse = courseCards.first();

      const courseHref = await firstCourse.getAttribute('href');

      expect(courseHref).toBeTruthy();

      const courseTitle = await firstCourse.locator('h3').innerText();

      const searchInput = page.getByRole('searchbox', {
        name: 'Search all courses',
      });

      await searchInput.fill(courseTitle);

      await expect(courseCards).toHaveCount(1);

      await courseCards.first().click();

      await expect(page).toHaveURL(
        new RegExp(`${courseHref!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`)
      );

      await expect(
        page.getByRole('heading', {
          name: 'Course content',
        })
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
