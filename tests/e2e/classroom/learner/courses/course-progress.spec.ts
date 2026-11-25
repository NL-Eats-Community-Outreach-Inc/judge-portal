import { test, expect, contextFor } from '../../../support/fixtures';

type Course = {
  course: {
    id: string;
    title: string;
    slug: string;
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

type Progress = {
  lessonId: string;
  completed: boolean;
};

test.describe('Learner course progress', () => {
  test('course progress reflects completed lessons', async ({ browser, learnerApi }) => {
    const [catalogResponse, progressResponse] = await Promise.all([
      learnerApi.get('/api/learner/catalog'),
      learnerApi.get('/api/learner/progress'),
    ]);

    expect(catalogResponse.ok()).toBeTruthy();
    expect(progressResponse.ok()).toBeTruthy();

    const courses = (await catalogResponse.json()) as Course[];
    const progressResult = await progressResponse.json();

    const progress: Progress[] = Array.isArray(progressResult)
      ? progressResult
      : (progressResult.data ?? []);

    expect(courses.length).toBeGreaterThan(0);

    const course = courses[0];

    const completedIds = new Set(
      progress.filter((record) => record.completed).map((record) => record.lessonId)
    );

    const completedCount = course.lessons.filter((lesson) => completedIds.has(lesson.id)).length;

    const totalLessons = course.lessons.length;

    const expectedPercentage =
      totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    const context = await contextFor(browser, 'learner');

    try {
      const page = await context.newPage();

      await page.goto(`/classroom/learner/courses/${course.course.slug}`);

      const progressBar = page.getByRole('progressbar', {
        name: 'Course completion',
      });

      await expect(progressBar).toBeVisible();

      await expect(progressBar).toHaveAttribute('aria-valuenow', String(expectedPercentage));

      await expect(
        page.getByText(`${completedCount} of ${totalLessons} lessons`, {
          exact: true,
        })
      ).toBeVisible();

      // The completed percentage should also appear in the course statistics.
      await expect(page.getByText(`${expectedPercentage}%`, { exact: true })).toBeVisible();

      // Reload and verify that progress remains consistent.
      await page.reload();

      await expect(progressBar).toHaveAttribute('aria-valuenow', String(expectedPercentage));

      await expect(
        page.getByText(`${completedCount} of ${totalLessons} lessons`, {
          exact: true,
        })
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
