import { test, expect, contextFor } from '../../../support/fixtures';

type Course = {
  course: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
  };
  modules: { id: string; title: string; slug: string }[];
  lessons: {
    id: string;
    title: string;
    slug: string;
    moduleId: string;
    sanityDocumentId: string | null;
  }[];
};

test.describe('Learner course overview', () => {
  test('course overview displays its information and content statistics', async ({
    browser,
    learnerApi,
  }) => {
    const response = await learnerApi.get('/api/learner/catalog');

    expect(response.ok(), 'Course catalogue should load').toBeTruthy();

    const courses = (await response.json()) as Course[];

    expect(courses.length, 'At least one course should exist').toBeGreaterThan(0);

    const course = courses[0];
    const context = await contextFor(browser, 'learner');

    try {
      const page = await context.newPage();

      await page.goto(`/classroom/learner/courses/${course.course.slug}`);

      // Course heading and description
      await expect(
        page.getByRole('heading', {
          name: course.course.title,
          exact: true,
        })
      ).toBeVisible();

      await expect(page.getByText('COURSE OVERVIEW')).toBeVisible();

      if (course.course.description) {
        await expect(page.getByText(course.course.description)).toBeVisible();
      } else {
        await expect(
          page.getByText('Explore the modules and lessons in this course.')
        ).toBeVisible();
      }

      // Course statistics
      await expect(
        page.getByText(course.modules.length === 1 ? 'Module' : 'Modules', {
          exact: true,
        })
      ).toBeVisible();

      await expect(
        page.getByText(course.lessons.length === 1 ? 'Lesson' : 'Lessons', {
          exact: true,
        })
      ).toBeVisible();

      await expect(page.getByText('Completed', { exact: true })).toBeVisible();

      // Overall progress
      await expect(page.getByText('Your progress')).toBeVisible();

      await expect(
        page.getByText(new RegExp(`\\d+ of ${course.lessons.length} lessons`))
      ).toBeVisible();

      await expect(page.getByRole('progressbar', { name: 'Course completion' })).toBeVisible();

      // Course content section
      await expect(page.getByRole('heading', { name: 'Course content' })).toBeVisible();

      if (course.modules.length === 0) {
        await expect(page.getByRole('heading', { name: 'No modules yet' })).toBeVisible();
      } else {
        for (const moduleData of course.modules) {
          await expect(
            page.getByRole('button', {
              name: new RegExp(moduleData.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            })
          ).toBeVisible();
        }
      }

      // Back navigation
      await expect(
        page.getByRole('link', { name: 'All courses', exact: true }).first()
      ).toHaveAttribute('href', '/classroom/learner');
    } finally {
      await context.close();
    }
  });
});
