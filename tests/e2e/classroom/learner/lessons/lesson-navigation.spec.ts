import { test, expect, contextFor } from '../../../support/fixtures';
import type { APIRequestContext } from '@playwright/test';

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
  lesson: {
    id: string;
    title: string;
    slug: string;
  };
  content: {
    title: string;
    contentBlocks?: { _key: string; _type: string }[];
  };
  navigation: {
    nextLessonId: string | null;
    nextLessonTitle: string | null;
    nextLessonSlug: string | null;
    nextModuleSlug: string | null;
  };
};

async function findLessonWithNavigation(api: APIRequestContext, wantsNextLesson: boolean) {
  const response = await api.get('/api/learner/catalog');
  expect(response.ok()).toBeTruthy();

  const courses = (await response.json()) as Course[];

  for (const course of courses) {
    for (const candidate of course.lessons) {
      if (!candidate.sanityDocumentId) continue;

      const moduleData = course.modules.find((item) => item.id === candidate.moduleId);

      if (!moduleData) continue;

      const query = new URLSearchParams({
        courseSlug: course.course.slug,
        moduleSlug: moduleData.slug,
      });

      const detailResponse = await api.get(
        `/api/learner/lessons/${encodeURIComponent(candidate.slug)}?${query}`
      );

      if (!detailResponse.ok()) continue;

      const detail = (await detailResponse.json()) as LessonDetail;

      const hasNextLesson = Boolean(
        detail.navigation?.nextLessonId &&
          detail.navigation?.nextLessonSlug &&
          detail.navigation?.nextModuleSlug
      );

      if (hasNextLesson !== wantsNextLesson) continue;

      return { course, moduleData, detail };
    }
  }

  return null;
}

test.describe('Learner lesson navigation', () => {
  test('learner can navigate to the next lesson', async ({ browser, learnerApi }) => {
    const selected = await findLessonWithNavigation(learnerApi, true);

    test.skip(!selected, 'No lesson with a following lesson is available');

    const { course, moduleData, detail } = selected!;

    const context = await contextFor(browser, 'learner');

    try {
      const page = await context.newPage();

      await page.goto(
        `/classroom/learner/courses/${course.course.slug}/module/${moduleData.slug}/lessons/${detail.lesson.slug}`
      );

      await expect(
        page.getByRole('heading', {
          name: detail.content.title,
          exact: true,
        })
      ).toBeVisible();

      // The next lesson link should show the expected title.
      const nextLessonLink = page.getByRole('link', {
        name: new RegExp(
          `Next lesson\\s*${(detail.navigation.nextLessonTitle ?? 'Next lesson').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
        ),
      });

      await expect(nextLessonLink).toBeVisible();

      const expectedHref =
        `/classroom/learner/courses/${course.course.slug}` +
        `/module/${detail.navigation.nextModuleSlug}` +
        `/lessons/${detail.navigation.nextLessonSlug}`;

      await expect(nextLessonLink).toHaveAttribute('href', expectedHref);

      await nextLessonLink.click();

      await expect(page).toHaveURL(
        new RegExp(`${expectedHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
      );

      // Confirm that the next lesson actually loaded.
      const nextDetailResponse = await learnerApi.get(
        `/api/learner/lessons/${encodeURIComponent(detail.navigation.nextLessonSlug!)}?${new URLSearchParams(
          {
            courseSlug: course.course.slug,
            moduleSlug: detail.navigation.nextModuleSlug!,
          }
        )}`
      );

      expect(nextDetailResponse.ok()).toBeTruthy();

      const nextDetail = (await nextDetailResponse.json()) as LessonDetail;

      await expect(
        page.getByRole('heading', {
          name: nextDetail.content.title,
          exact: true,
        })
      ).toBeVisible();

      // The catalogue navigation remains available.
      await expect(page.getByRole('link', { name: 'All courses', exact: true })).toHaveAttribute(
        'href',
        '/classroom/learner/courses'
      );
    } finally {
      await context.close();
    }
  });

  test('final lesson links back to its course instead of showing a next lesson', async ({
    browser,
    learnerApi,
  }) => {
    const selected = await findLessonWithNavigation(learnerApi, false);

    test.skip(!selected, 'No final lesson with available content was found');

    const { course, moduleData, detail } = selected!;

    const context = await contextFor(browser, 'learner');

    try {
      const page = await context.newPage();

      await page.goto(
        `/classroom/learner/courses/${course.course.slug}/module/${moduleData.slug}/lessons/${detail.lesson.slug}`
      );

      await expect(
        page.getByRole('heading', {
          name: detail.content.title,
          exact: true,
        })
      ).toBeVisible();

      await expect(page.getByRole('link', { name: 'Back to course' })).toHaveAttribute(
        'href',
        `/classroom/learner/courses/${course.course.slug}`
      );

      await expect(page.getByRole('link', { name: /Next lesson/ })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
