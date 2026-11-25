import { test, expect, mobileContextFor } from '../../../support/fixtures';
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
    contentBlocks?: {
      _key: string;
      _type: string;
      video?: { asset?: { playbackId?: string | null } | null } | null;
    }[];
  };
};

async function findPublishedLesson(api: APIRequestContext) {
  const response = await api.get('/api/learner/catalog');
  expect(response.ok()).toBeTruthy();

  const courses = (await response.json()) as Course[];

  for (const course of courses) {
    for (const lesson of course.lessons ?? []) {
      if (!lesson.sanityDocumentId) continue;

      const moduleData = course.modules.find((item) => item.id === lesson.moduleId);

      if (!moduleData) continue;

      const query = new URLSearchParams({
        courseSlug: course.course.slug,
        moduleSlug: moduleData.slug,
      });

      const detailResponse = await api.get(
        `/api/learner/lessons/${encodeURIComponent(lesson.slug)}?${query}`
      );

      if (!detailResponse.ok()) continue;

      const detail = (await detailResponse.json()) as LessonDetail;

      if (!detail.content?.title) continue;

      return {
        course,
        module: moduleData,
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

      const moduleData = course.modules.find((item) => item.id === lesson.moduleId);

      if (!moduleData) continue;

      const query = new URLSearchParams({
        courseSlug: course.course.slug,
        moduleSlug: moduleData.slug,
      });

      const detailResponse = await api.get(
        `/api/learner/lessons/${encodeURIComponent(lesson.slug)}?${query}`
      );

      if (!detailResponse.ok()) continue;

      const detail = (await detailResponse.json()) as LessonDetail;

      const videoBlock = detail.content?.contentBlocks?.find(
        (block) => block._type === 'videoBlock' && block.video?.asset?.playbackId
      );
      if (!videoBlock) continue;

      const tokenQuery = new URLSearchParams({
        lessonId: detail.lesson.id,
        blockKey: videoBlock._key,
      });
      const tokenResponse = await api.get(`/api/learner/video-token?${tokenQuery}`);

      if (!tokenResponse.ok()) continue;

      const token = await tokenResponse.json();

      if (!token.playbackId || !token.token) continue;

      return {
        course,
        module: moduleData,
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
        `/classroom/learner/courses/${course.course.slug}/module/${module.slug}/lessons/${lesson.slug}`
      );

      await expect(page).toHaveURL(
        /\/classroom\/learner\/courses\/[^/]+\/module\/[^/]+\/lessons\/[^/]+/
      );

      await expect(
        page.getByRole('heading', { level: 1 }).filter({
          hasNotText: 'Student Portal',
        })
      ).toBeVisible();

      await expect(
        page.getByRole('navigation', {
          name: 'Learner mobile navigation',
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
        `/classroom/learner/courses/${course.course.slug}/module/${module.slug}/lessons/${lesson.slug}`
      );

      await expect(page.getByText('Video lesson', { exact: true })).toBeVisible();

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
