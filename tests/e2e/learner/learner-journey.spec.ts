import { test, expect, contextFor, ACCOUNTS } from '@/tests/e2e/support/fixtures';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { learnerProgress } from '@/lib/db/schema';

/**
 * Learner Full Journey — End-to-End Test
 *
 * Tests the learner experience from browsing courses to completing a lesson.
 *
 * This test:
 * 1. Opens the learner dashboard and verifies the course catalogue.
 * 2. Checks that My Learning displays the available courses.
 * 3. Finds an uncompleted lesson with video content.
 * 4. Opens the course and verifies its progress indicator.
 * 5. Expands modules and verifies lesson navigation.
 * 6. Checks lesson content and video playback.
 * 7. Completes the lesson and verifies saved progress.
 * 8. Confirms course progress persists after reloading.
 *
 * Uses a saved learner authentication state; login is not tested here.
 */

type Course = {
  course: {
    id: string;
    title: string;
    slug: string;
  };
  modules: { id: string; title: string; slug: string }[];
  lessons: {
    id: string;
    slug: string;
    moduleId: string;
    title: string;
    sanityDocumentId: string | null;
  }[];
};

type LessonResponse = {
  lesson: {
    id: string;
    title: string;
    slug: string;
    moduleId: string;
  };
  content: {
    title: string;
    lessonFormat: 'text' | 'video' | 'both';
    content: unknown[];
  };
};

type Progress = {
  lessonId: string;
  completed: boolean;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('Learner full journey', () => {
  test('learner can browse courses, play a lesson, and save progress', async ({ browser }) => {
    const context = await contextFor(browser, 'learner');
    try {
      // Reset progress before the test.
      await db
        .delete(learnerProgress)
        .where(eq(learnerProgress.userId, '5e4eb0b4-cf23-46c4-80da-16ee17823e88'));

      const page = await context.newPage();

      // 1. Dashboard
      await page.goto('/learner');

      await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible();

      await expect(page.getByText('Loading your courses...')).toHaveCount(0);
      await expect(page.getByText(/^Error loading courses\:/)).toHaveCount(0);

      const catalogResponse = await page.evaluate(async () => {
        const response = await fetch('/api/learner/catalog');

        if (!response.ok) {
          throw new Error(`Catalogue request failed: ${response.status}`);
        }

        return response.json();
      });

      const courses = catalogResponse as Course[];

      expect(courses.length, 'The learner catalogue should contain courses').toBeGreaterThan(0);

      const dashboardLinks = page.locator('a[href^="/learner/courses/"]');

      await expect(dashboardLinks).toHaveCount(courses.length);

      for (const item of courses) {
        const courseLink = page.locator(`a[href="/learner/courses/${item.course.slug}"]`);

        await expect(courseLink).toHaveCount(1);
        await expect(courseLink).toContainText(item.course.title);
      }

      // 2. Course catalogue
      await page.getByRole('link', { name: 'My Learning' }).first().click();
      await expect(page).toHaveURL(/\/learner\/courses\/?$/);

      await expect(page.getByRole('heading', { name: 'All courses' })).toBeVisible();

      const allCourseLinks = page.locator('a[href^="/learner/courses/"]');
      await expect(allCourseLinks).toHaveCount(courses.length);

      for (const item of courses) {
        const courseLink = page.locator(`a[href="/learner/courses/${item.course.slug}"]`);

        await expect(courseLink).toHaveCount(1);
        await expect(courseLink).toContainText(item.course.title);
      }

      // 3. Find an uncompleted lesson that actually supports video playback
      const progressResponse = await page.evaluate(async () => {
        const response = await fetch('/api/learner/progress');

        if (!response.ok) {
          throw new Error(`Progress request failed: ${response.status}`);
        }

        return response.json();
      });

      const progressRecords: Progress[] = Array.isArray(progressResponse)
        ? progressResponse
        : (progressResponse.data ?? []);

      const completedIds = new Set(
        progressRecords.filter((record) => record.completed).map((record) => record.lessonId)
      );

      let selectedCourse: Course | undefined;
      let selectedLesson: LessonResponse | undefined;

      for (const item of courses) {
        for (const candidate of item.lessons) {
          if (!candidate.sanityDocumentId || completedIds.has(candidate.id)) {
            continue;
          }

          const result = await page.evaluate(
            async ({ lessonSlug, courseSlug, moduleSlug }) => {
              const query = new URLSearchParams({ courseSlug, moduleSlug });

              const response = await fetch(
                `/api/learner/lessons/${encodeURIComponent(lessonSlug)}?${query.toString()}`
              );

              return response.ok ? response.json() : null;
            },
            {
              lessonSlug: candidate.slug,
              courseSlug: item.course.slug,
              moduleSlug: item.modules.find((module) => module.id === candidate.moduleId)!.slug,
            }
          );

          if (!result) continue;

          const format = result.content?.lessonFormat;

          // Text-only lessons cannot satisfy this test's video-playback steps.
          if (format !== 'video' && format !== 'both') continue;

          const videoCheck = await page.evaluate(async (lessonId) => {
            const response = await fetch(
              `/api/learner/video-token?lessonId=${encodeURIComponent(lessonId)}`
            );

            return {
              ok: response.ok,
              body: await response.json(),
            };
          }, candidate.id);

          if (!videoCheck.ok || !videoCheck.body?.playbackId || !videoCheck.body?.token) {
            continue;
          }

          selectedCourse = item;
          selectedLesson = result as LessonResponse;
          break;
        }

        if (selectedLesson) break;
      }

      expect(
        selectedLesson,
        'No uncompleted video lesson with a valid playback token was found in the course catalogue'
      ).toBeDefined();

      const course = selectedCourse!;
      const lesson = selectedLesson!;

      // 4. Course overview
      await page.goto(`/learner/courses/${course.course.slug}`);
      await expect(page.getByRole('heading', { name: course.course.title })).toBeVisible();

      await expect(page.getByRole('heading', { name: 'Course content' })).toBeVisible();

      await expect(page.getByRole('progressbar', { name: 'Course completion' })).toBeVisible();

      // 5. Module and lesson navigation
      for (const module of course.modules) {
        const moduleButton = page.getByRole('button', {
          name: new RegExp(escapeRegExp(module.title)),
        });

        await expect(moduleButton).toBeVisible();

        if ((await moduleButton.getAttribute('aria-expanded')) !== 'true') {
          await moduleButton.click();
        }

        const moduleLessons = course.lessons.filter((item) => item.moduleId === module.id);

        for (const moduleLesson of moduleLessons) {
          await expect(
            page.locator(
              `a[href="/learner/courses/${course.course.slug}/module/${module.slug}/lessons/${moduleLesson.slug}"]`
            )
          ).toBeVisible();
        }
      }

      await page
        .locator(
          `a[href="/learner/courses/${course.course.slug}/module/${course.modules.find((module) => module.id === lesson.lesson.moduleId)!.slug}/lessons/${lesson.lesson.slug}"]`
        )
        .click();

      await expect(page.getByRole('heading', { name: lesson.content.title })).toBeVisible();

      // 6. Verify lesson text content and video playback
      if (lesson.content.lessonFormat === 'both' || lesson.content.lessonFormat === 'text') {
        await expect(page.getByRole('heading', { name: 'Lesson material' })).toBeVisible();
        await expect(page.locator('.prose')).not.toBeEmpty();
      }

      const player = page.locator('mux-player');

      await expect(player).toHaveCount(0);

      await page.getByRole('button', { name: 'Play lesson video' }).click();

      await expect(player).toBeVisible({ timeout: 15_000 });
      await expect
        .poll(
          () =>
            player.evaluate((element) => {
              return Boolean((element as HTMLElement & { playbackId?: string }).playbackId);
            }),
          { timeout: 15_000 }
        )
        .toBe(true);

      // MuxVideo uses autoPlay; wait for playback rather than clicking a
      // control inside Mux Player (which may change across Mux versions).
      await expect
        .poll(
          () =>
            player.evaluate((element) => {
              return (element as HTMLElement & { currentTime: number }).currentTime;
            }),
          { timeout: 30_000 }
        )
        .toBeGreaterThan(0);

      // 7. Complete lesson and verify saved progress
      await page.getByRole('button', { name: 'Complete Lesson' }).click();
      await expect(page.getByRole('heading', { name: 'Lesson completed!' })).toBeVisible();

      await expect(page.getByRole('button', { name: 'Completed' })).toBeDisabled();

      await expect
        .poll(async () => {
          const records = await page.evaluate(async () => {
            const response = await fetch('/api/learner/progress');
            if (!response.ok) {
              return null;
            }
            return response.json();
          });

          const items: Progress[] = Array.isArray(records) ? records : (records?.data ?? []);
          return items.some((item) => item.lessonId === lesson.lesson.id && item.completed);
        })
        .toBe(true);
      // 8. Verify persisted course progress
      await page.goto(`/learner/courses/${course.course.slug}`);
      const progressBar = page.getByRole('progressbar', {
        name: 'Course completion',
      });

      await expect(progressBar).toBeVisible();
      const completedCount = course.lessons.filter(
        (item) => completedIds.has(item.id) || item.id === lesson.lesson.id
      ).length;

      const expectedPercentage = Math.round((completedCount / course.lessons.length) * 100);

      await expect(progressBar).toHaveAttribute('aria-valuenow', String(expectedPercentage));

      await expect(
        page.getByText(`${completedCount} of ${course.lessons.length} lessons`)
      ).toBeVisible();

      await page.reload();
      await expect(page.getByRole('progressbar', { name: 'Course completion' })).toHaveAttribute(
        'aria-valuenow',
        String(expectedPercentage)
      );
    } finally {
      // Reset progress after the test.
      await db
        .delete(learnerProgress)
        .where(eq(learnerProgress.userId, '5e4eb0b4-cf23-46c4-80da-16ee17823e88'));

      await context.close();
    }
  });
});
