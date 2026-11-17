import { test, expect, contextFor } from '../../support/fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

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
    lessonFormat: 'text' | 'video' | 'both';
    content: unknown[];
  };
  navigation: {
    nextLessonId: string | null;
    nextLessonTitle: string | null;
    nextLessonSlug: string | null;
    nextModuleSlug: string | null;
  };
};

async function findVideoLesson(api: APIRequestContext) {
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

      if (detail.content.lessonFormat !== 'video' && detail.content.lessonFormat !== 'both') {
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
        detail,
        token,
      };
    }
  }

  return null;
}

async function verifyCompletionState(page: Page) {
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

test.describe('Learner lesson viewer', () => {
  test('learner can open a video lesson and play its content', async ({ browser, learnerApi }) => {
    const selected = await findVideoLesson(learnerApi);

    test.skip(!selected, 'No video lesson with a valid Mux playback token is available');

    const { course, module, detail } = selected!;

    const context = await contextFor(browser, 'learner');

    try {
      const page = await context.newPage();

      await page.goto(
        `/learner/courses/${course.course.slug}/module/${module.slug}/lessons/${detail.lesson.slug}`
      );

      // Lesson heading and format
      await expect(
        page.getByRole('heading', {
          name: detail.content.title,
          exact: true,
        })
      ).toBeVisible();

      await expect(
        page
          .getByText(detail.content.lessonFormat === 'both' ? 'Video & text' : 'Video lesson', {
            exact: true,
          })
          .first()
      ).toBeVisible();

      // Video player
      const player = page.locator('mux-player');

      await page.getByRole('button', { name: 'Play lesson video' }).click();

      await expect(player).toBeVisible();

      await expect
        .poll(
          () =>
            player.evaluate((element) =>
              Boolean((element as HTMLElement & { playbackId?: string }).playbackId)
            ),
          { timeout: 20_000 }
        )
        .toBe(true);

      // Verify that the Mux player can actually start playback.
      await player.evaluate(async (element) => {
        const muxPlayer = element as HTMLElement & {
          play: () => Promise<void>;
          paused: boolean;
          currentTime: number;
        };

        await muxPlayer.play();
      });

      await expect
        .poll(
          () =>
            player.evaluate((element) => {
              const muxPlayer = element as HTMLElement & {
                paused: boolean;
                currentTime: number;
              };

              return {
                paused: muxPlayer.paused,
                currentTime: muxPlayer.currentTime,
              };
            }),
          { timeout: 30_000 }
        )
        .toMatchObject({
          paused: false,
        });

      await expect
        .poll(
          () =>
            player.evaluate(
              (element) => (element as HTMLElement & { currentTime: number }).currentTime
            ),
          { timeout: 30_000 }
        )
        .toBeGreaterThan(0);

      // Verify completion UI, whether already completed or still incomplete.
      await verifyCompletionState(page);

      // Course navigation should be available.
      await expect(page.getByRole('link', { name: 'All courses', exact: true })).toHaveAttribute(
        'href',
        '/learner/courses'
      );
    } finally {
      await context.close();
    }
  });
});
