import { test, expect, contextFor } from '../../support/fixtures';

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

type LessonDetail = {
  lesson: { id: string; title: string; slug: string };
  content: {
    title: string;
    lessonFormat: 'text' | 'video' | 'both';
    content: unknown[];
  };
};

type Format = 'text' | 'video' | 'both';

async function findLessonByFormat(api: { get: (url: string) => Promise<any> }, format: Format) {
  const response = await api.get('/api/learner/catalog');
  expect(response.ok()).toBeTruthy();

  const courses = (await response.json()) as Course[];

  for (const course of courses) {
    for (const candidate of course.lessons) {
      if (!candidate.sanityDocumentId) continue;

      const module = course.modules.find((item) => item.id === candidate.moduleId);

      if (!module) continue;

      const query = new URLSearchParams({
        courseSlug: course.course.slug,
        moduleSlug: module.slug,
      });

      const detailResponse = await api.get(
        `/api/learner/lessons/${encodeURIComponent(candidate.slug)}?${query}`
      );

      if (!detailResponse.ok()) continue;

      const detail = (await detailResponse.json()) as LessonDetail;

      if (detail.content.lessonFormat !== format) continue;

      if (format === 'video' || format === 'both') {
        const tokenResponse = await api.get(
          `/api/learner/video-token?lessonId=${encodeURIComponent(detail.lesson.id)}`
        );

        if (!tokenResponse.ok()) continue;

        const token = await tokenResponse.json();

        if (!token.playbackId || !token.token) continue;
      }

      return { course, module, detail };
    }
  }

  return null;
}

async function verifyCompletionState(page: import('@playwright/test').Page) {
  const completionHeading = page.getByRole('heading', {
    name: /^(Finished this lesson\?|Lesson completed!)$/,
  });

  await expect(completionHeading).toBeVisible();

  const completeButton = page.getByRole('button', {
    name: 'Complete Lesson',
  });

  const completedButton = page.getByRole('button', {
    name: 'Completed',
  });

  await expect(completeButton.or(completedButton)).toBeVisible();

  if (await completedButton.isVisible()) {
    await expect(completedButton).toBeDisabled();
  }
}

async function verifyLessonFormat(
  browser: Parameters<typeof contextFor>[0],
  api: Parameters<typeof findLessonByFormat>[0],
  format: Format
) {
  const selected = await findLessonByFormat(api, format);

  test.skip(!selected, `No lesson with format "${format}" and the required content is available`);

  const { course, module, detail } = selected!;

  const context = await contextFor(browser, 'learner');

  try {
    const page = await context.newPage();

    await page.goto(
      `/learner/courses/${course.course.slug}/module/${module.slug}/lessons/${detail.lesson.slug}`
    );

    await expect(
      page.getByRole('heading', {
        name: detail.content.title,
        exact: true,
      })
    ).toBeVisible();

    const player = page.locator('mux-player');

    if (format === 'video' || format === 'both') {
      await expect(page.getByRole('button', { name: 'Play lesson video' })).toBeVisible();

      await page.getByRole('button', { name: 'Play lesson video' }).click();

      await expect(player).toBeVisible();
    }

    const lessonMaterial = page.getByRole('heading', {
      name: 'Lesson material',
    });

    if (format === 'text') {
      await expect(lessonMaterial).toBeVisible();
      await expect(page.locator('.prose')).toBeVisible();
      await expect(player).toHaveCount(0);

      await expect(page.getByText('Text lesson', { exact: true })).toBeVisible();
    }

    if (format === 'video') {
      await expect(player).toBeVisible();
      await expect(lessonMaterial).toHaveCount(0);

      await expect(page.getByText('Video lesson', { exact: true }).first()).toBeVisible();
    }

    if (format === 'both') {
      await expect(player).toBeVisible();
      await expect(lessonMaterial).toBeVisible();
      await expect(page.locator('.prose')).toBeVisible();

      await expect(page.getByText('Video & text', { exact: true }).first()).toBeVisible();
    }

    await verifyCompletionState(page);
  } finally {
    await context.close();
  }
}

test.describe('Learner lesson formats', () => {
  test('text-only lessons display written material without a video player', async ({
    browser,
    learnerApi,
  }) => {
    await verifyLessonFormat(browser, learnerApi, 'text');
  });

  test('video-only lessons display a video player without written material', async ({
    browser,
    learnerApi,
  }) => {
    await verifyLessonFormat(browser, learnerApi, 'video');
  });

  test('combined lessons display both video and written material', async ({
    browser,
    learnerApi,
  }) => {
    await verifyLessonFormat(browser, learnerApi, 'both');
  });
});
