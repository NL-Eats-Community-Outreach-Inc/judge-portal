import { test, expect, contextFor } from '../../support/fixtures';

type Course = {
  course: {
    id: string;
    title: string;
    slug: string;
  };
  modules: {
    id: string;
    title: string;
    slug: string;
  }[];
  lessons: {
    id: string;
    title: string;
    slug: string;
    moduleId: string;
    sanityDocumentId: string | null;
  }[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('Learner module navigation', () => {
  test('learner can expand modules and navigate to available lessons', async ({
    browser,
    learnerApi,
  }) => {
    const response = await learnerApi.get('/api/learner/catalog');

    expect(response.ok()).toBeTruthy();

    const courses = (await response.json()) as Course[];

    const course = courses.find((item) => item.modules.length > 0);

    expect(course, 'At least one course with modules should exist').toBeDefined();

    const selectedCourse = course!;

    const context = await contextFor(browser, 'learner');

    try {
      const page = await context.newPage();

      await page.goto(`/learner/courses/${selectedCourse.course.slug}`);

      await expect(
        page.getByRole('heading', {
          name: selectedCourse.course.title,
          exact: true,
        })
      ).toBeVisible();

      // The first module should be expanded automatically.
      const firstModule = selectedCourse.modules[0];

      const firstModuleButton = page.getByRole('button', {
        name: new RegExp(escapeRegExp(firstModule.title)),
      });

      await expect(firstModuleButton).toHaveAttribute('aria-expanded', 'true');

      // Check that every module can be expanded.
      for (const [index, module] of selectedCourse.modules.entries()) {
        const moduleButton = page.getByRole('button', {
          name: new RegExp(escapeRegExp(module.title)),
        });

        await expect(moduleButton).toBeVisible();

        if (index !== 0) {
          await expect(moduleButton).toHaveAttribute('aria-expanded', 'false');

          await moduleButton.click();

          await expect(moduleButton).toHaveAttribute('aria-expanded', 'true');
        }

        const moduleLessons = selectedCourse.lessons.filter(
          (lesson) => lesson.moduleId === module.id
        );

        const availableLessons = moduleLessons.filter((lesson) => lesson.sanityDocumentId);

        const unavailableLessons = moduleLessons.filter((lesson) => !lesson.sanityDocumentId);

        // Available lessons should link to their lesson viewer.
        for (const lesson of availableLessons) {
          const lessonLink = page.locator(
            `a[href="/learner/courses/${selectedCourse.course.slug}/module/${module.slug}/lessons/${lesson.slug}"]`
          );

          await expect(lessonLink).toBeVisible();
          await expect(lessonLink).toContainText(lesson.title);
        }

        // Unavailable lessons should not have lesson links.
        for (const lesson of unavailableLessons) {
          const lessonLink = page.locator(
            `a[href="/learner/courses/${selectedCourse.course.slug}/module/${module.slug}/lessons/${lesson.slug}"]`
          );

          await expect(lessonLink).toHaveCount(0);
          await expect(page.getByText(lesson.title, { exact: false }).first()).toBeVisible();
        }
      }

      // Verify that an expanded module can be collapsed again.
      const lastModule = selectedCourse.modules.at(-1)!;

      const lastModuleButton = page.getByRole('button', {
        name: new RegExp(escapeRegExp(lastModule.title)),
      });

      await expect(lastModuleButton).toHaveAttribute('aria-expanded', 'true');

      await lastModuleButton.click();

      await expect(lastModuleButton).toHaveAttribute('aria-expanded', 'false');
    } finally {
      await context.close();
    }
  });
});
