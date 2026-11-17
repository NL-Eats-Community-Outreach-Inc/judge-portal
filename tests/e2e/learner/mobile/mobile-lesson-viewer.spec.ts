import { test, expect, mobileContextFor } from '../../support/fixtures';
import type { APIRequestContext } from '@playwright/test';

type Course = {
  course: {
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

type LessonDetail = {
  lesson: {
    id: string;
    title: string;
    slug: string;
  };
  content: {
    title: string;
    lessonFormat: 'text' | 'video' | 'both';
    content: unknown[];
  };
};

async function findPublishedLesson(api: APIRequestContext) {
  const response = await api.get('/api/learner/catalog');
  expect(response.ok()).toBeTruthy();

  const courses = (await response.json()) as Course[];

  for (const course of courses) {
    for (const lesson of course.lessons ?? []) {
      if (!lesson.sanityDocumentId) continue;

      const module = course.modules.find((item) => item.id === lesson.moduleId);

      if (!module) continue;

      const query = new URLSearchParams({
        courseSlug: course.course.slug,
        moduleSlug: module.slug,
      });

      const detailResponse = await api.get(
        `/api/learner/lessons/${encodeURIComponent(lesson.slug)}?${query}`
      );

      if (!detailResponse.ok()) continue;

      const detail = (await detailResponse.json()) as LessonDetail;

      if (!detail.content?.title) continue;

      return {
        course,
        module,
        lesson,
        detail,
      };
    }
  }

  return null;
}

async function findVideoLesson(api: APIRequestContext) {
  const response = await api.get('/api/learner/catalog');
  expect(response.ok()).toBeTruthy();

  const courses = (await response.json()) as Course[];

  for (const course of courses) {
    for (const lesson of course.lessons ?? []) {
      if (!lesson.sanityDocumentId) continue;

      const module = course.modules.find((item) => item.id === lesson.moduleId);

      if (!module) continue;

      const query = new URLSearchParams({
        courseSlug: course.course.slug,
        moduleSlug: module.slug,
      });

      const detailResponse = await api.get(
        `/api/learner/lessons/${encodeURIComponent(lesson.slug)}?${query}`
      );

      if (!detailResponse.ok()) continue;

      const detail = (await detailResponse.json()) as LessonDetail;

      if (detail.content?.lessonFormat !== 'video' && detail.content?.lessonFormat !== 'both') {
        continue;
      }

      const tokenResponse = await api.get(
        `/api/learner/video-token?lessonId=${encodeURIComponent(detail.lesson.id)}`
      );

      if (!tokenResponse.ok()) continue;

      const token = await tokenResponse.json();

      if (!token.playbackId || !token.token) continue;

      return {
        course,
        module,
        lesson,
        detail,
      };
    }
  }

  return null;
}

test.describe('Mobile lesson viewer', () => {
  test('displays lesson content correctly on mobile', async ({ browser, learnerApi }) => {
    const selected = await findPublishedLesson(learnerApi);

    test.skip(!selected, 'No published lesson is available in the learner catalogue');

    const { course, module, lesson } = selected!;

    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto(
        `/learner/courses/${course.course.slug}/module/${module.slug}/lessons/${lesson.slug}`
      );

      await expect(page).toHaveURL(/\/learner\/courses\/[^/]+\/module\/[^/]+\/lessons\/[^/]+/);

      await expect(
        page.getByRole('heading', { level: 1 }).filter({
          hasNotText: 'Student Portal',
        })
      ).toBeVisible();

      await expect(
        page.getByRole('navigation', {
          name: 'Mobile navigation',
        })
      ).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: 'All courses',
          exact: true,
        })
      ).toBeVisible();

      await expect(
        page
          .getByRole('heading', {
            name: 'Finished this lesson?',
          })
          .or(
            page.getByRole('heading', {
              name: 'Lesson completed!',
            })
          )
      ).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );

      expect(hasHorizontalOverflow).toBe(false);
    } finally {
      await context.close();
    }
  });

  test('lesson video fits within the mobile viewport when available', async ({
    browser,
    learnerApi,
  }) => {
    const selected = await findVideoLesson(learnerApi);

    test.skip(!selected, 'No video lesson with a valid Mux playback token is available');

    const { course, module, lesson } = selected!;

    const context = await mobileContextFor(browser);
    const page = await context.newPage();

    try {
      await page.goto(
        `/learner/courses/${course.course.slug}/module/${module.slug}/lessons/${lesson.slug}`
      );

      await expect(page.getByText(/^(Video lesson|Video & text)$/).first()).toBeVisible();

      await page.getByRole('button', { name: 'Play lesson video' }).click();

      const player = page.locator('mux-player');

      await expect(player).toBeVisible();

      const playerBox = await player.boundingBox();

      expect(playerBox).not.toBeNull();
      expect(playerBox!.width).toBeLessThanOrEqual(393);

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );

      expect(hasHorizontalOverflow).toBe(false);
    } finally {
      await context.close();
    }
  });
});
