import { test, expect, mobileContextFor } from '../../../support/fixtures';

import type { APIResponse } from '@playwright/test';

type CatalogCourse = {
  course: {
    title: string;
    slug: string;
  };
  modules: {
    id: string;
    title: string;
    slug: string;
  }[];
};

async function findCourseWithModules(api: {
  get: (url: string) => Promise<APIResponse>;
}): Promise<CatalogCourse | null> {
  const response = await api.get('/api/learner/catalog');
  expect(response.ok()).toBeTruthy();

  const courses = (await response.json()) as CatalogCourse[];

  return courses.find((course) => course.modules?.length > 0) ?? null;
}

test.describe('Mobile course overview', () => {
  test('displays course information and content on mobile', async ({ browser, learnerApi }) => {
    const selectedCourse = await findCourseWithModules(learnerApi);

    test.skip(!selectedCourse, 'No course with modules is available');

    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto(`/classroom/learner/courses/${selectedCourse!.course.slug}`);

      await expect(page.getByText('COURSE OVERVIEW')).toBeVisible();

      const courseHeading = page.locator('main').getByRole('heading', {
        level: 1,
      });

      await expect(courseHeading).toBeVisible();

      await expect(page.getByRole('heading', { name: 'Course content' })).toBeVisible();

      await expect(
        page.getByRole('progressbar', {
          name: 'Course completion',
        })
      ).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: 'All courses',
          exact: true,
        })
      ).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );

      expect(hasHorizontalOverflow).toBe(false);
    } finally {
      await context.close();
    }
  });

  test('can expand and collapse course modules on mobile', async ({ browser, learnerApi }) => {
    const selectedCourse = await findCourseWithModules(learnerApi);

    test.skip(!selectedCourse, 'No course with modules is available');

    const firstModule = selectedCourse!.modules[0];

    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto(`/classroom/learner/courses/${selectedCourse!.course.slug}`);

      await expect(page.getByRole('heading', { name: 'Course content' })).toBeVisible();

      // Locate the accordion using the actual module title.
      const moduleButton = page.getByRole('button', {
        name: new RegExp(firstModule.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      });

      await expect(moduleButton).toBeVisible();

      // The first module is expanded by default.
      await expect(moduleButton).toHaveAttribute('aria-expanded', 'true');

      // Collapse the module.
      await moduleButton.click();

      await expect(moduleButton).toHaveAttribute('aria-expanded', 'false');

      // Expand it again.
      await moduleButton.click();

      await expect(moduleButton).toHaveAttribute('aria-expanded', 'true');

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );

      expect(hasHorizontalOverflow).toBe(false);
    } finally {
      await context.close();
    }
  });
});
