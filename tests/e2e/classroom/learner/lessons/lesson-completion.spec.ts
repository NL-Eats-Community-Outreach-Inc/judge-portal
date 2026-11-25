import { test, expect, contextFor } from '../../../support/fixtures';

type Course = {
  course: { title: string; slug: string };
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

type LessonDetail = {
  lesson: { id: string; title: string; slug: string };
  content: {
    title: string;
    contentBlocks?: { _key: string; _type: string }[];
  };
};

test.describe('Learner lesson completion', () => {
  test('learner can complete a lesson and save progress', async ({ browser, learnerApi }) => {
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

    const completedIds = new Set(
      progress.filter((item) => item.completed).map((item) => item.lessonId)
    );

    let selected:
      | {
          course: Course;
          module: NonNullable<Course['modules'][number]>;
          detail: LessonDetail;
        }
      | undefined;

    // Find an available lesson that has not already been completed.
    for (const course of courses) {
      for (const candidate of course.lessons) {
        if (!candidate.sanityDocumentId || completedIds.has(candidate.id)) {
          continue;
        }

        const moduleData = course.modules.find((item) => item.id === candidate.moduleId);

        if (!moduleData) continue;

        const query = new URLSearchParams({
          courseSlug: course.course.slug,
          moduleSlug: moduleData.slug,
        });

        const detailResponse = await learnerApi.get(
          `/api/learner/lessons/${encodeURIComponent(candidate.slug)}?${query}`
        );

        if (!detailResponse.ok()) continue;

        const detail = (await detailResponse.json()) as LessonDetail;

        if (detail.lesson.id !== candidate.id) continue;

        selected = { course, module: moduleData, detail };
        break;
      }

      if (selected) break;
    }

    test.skip(
      !selected,
      'No available uncompleted lesson was found. The E2E learner may have completed all available lessons.'
    );

    const { course, module, detail } = selected!;

    const context = await contextFor(browser, 'learner');

    try {
      const page = await context.newPage();

      await page.goto(
        `/classroom/learner/courses/${course.course.slug}/module/${module.slug}/lessons/${detail.lesson.slug}`
      );

      await expect(
        page.getByRole('heading', {
          name: detail.content.title,
          exact: true,
        })
      ).toBeVisible();

      // Initial incomplete state
      await expect(page.getByRole('heading', { name: 'Finished this lesson?' })).toBeVisible();

      await expect(page.getByRole('button', { name: 'Complete Lesson' })).toBeEnabled();

      // Complete the lesson through the actual UI.
      await page.getByRole('button', { name: 'Complete Lesson' }).click();

      // Successful completion state
      await expect(page.getByRole('heading', { name: 'Lesson completed!' })).toBeVisible();

      await expect(page.getByText('Your progress has been saved.')).toBeVisible();

      await expect(page.getByRole('button', { name: 'Completed' })).toBeDisabled();

      // Verify that the server persisted the completion.
      await expect
        .poll(
          async () => {
            const response = await learnerApi.get('/api/learner/progress');

            if (!response.ok()) return false;

            const result = await response.json();

            const records: Progress[] = Array.isArray(result) ? result : (result.data ?? []);

            return records.some((item) => item.lessonId === detail.lesson.id && item.completed);
          },
          { timeout: 15_000 }
        )
        .toBe(true);

      // Reload and verify that the completed state is restored.
      await page.reload();

      await expect(page.getByRole('heading', { name: 'Lesson completed!' })).toBeVisible();

      await expect(page.getByRole('button', { name: 'Completed' })).toBeDisabled();
    } finally {
      await context.close();
    }
  });
});
