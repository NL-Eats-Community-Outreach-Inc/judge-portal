import { test, expect, contextFor } from '../../../support/fixtures';
import type { APIRequestContext, Page } from '@playwright/test';
import { readLifecycleState } from '../../support/lifecycle-state';

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

type ContentBlock = {
  _key: string;
  _type: string;
  video?: { asset?: { playbackId?: string | null } | null } | null;
};

type LessonDetail = {
  lesson: { id: string; title: string; slug: string };
  content: {
    title: string;
    contentBlocks?: ContentBlock[];
  };
};

type Format = 'text' | 'video' | 'both';

function hasBlock(blocks: ContentBlock[], type: string) {
  return blocks.some((block) => block._type === type);
}

async function findLessonByFormat(api: APIRequestContext, format: Format) {
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
      const blocks = detail.content?.contentBlocks ?? [];
      const textBlock = hasBlock(blocks, 'textBlock');
      const videoBlock = blocks.find(
        (block) => block._type === 'videoBlock' && block.video?.asset?.playbackId
      );

      const matches =
        format === 'text'
          ? textBlock && !hasBlock(blocks, 'videoBlock')
          : format === 'video'
            ? Boolean(videoBlock) && !textBlock
            : textBlock && Boolean(videoBlock);

      if (!matches) continue;

      if (videoBlock) {
        const tokenQuery = new URLSearchParams({
          lessonId: detail.lesson.id,
          blockKey: videoBlock._key,
        });
        const tokenResponse = await api.get(`/api/learner/video-token?${tokenQuery}`);
        if (!tokenResponse.ok()) continue;

        const token = await tokenResponse.json();
        if (!token.playbackId || !token.token) continue;
      }

      return {
        course,
        moduleData,
        detail,
        hasText: textBlock,
        hasVideo: Boolean(videoBlock),
      };
    }
  }

  return null;
}

async function verifyCompletionState(page: Page) {
  const completionHeading = page.getByRole('heading', {
    name: /^(Finished this lesson\\?|Lesson completed!)$/,
  });
  await expect(completionHeading).toBeVisible();

  const completeButton = page.getByRole('button', { name: 'Complete Lesson' });
  const completedButton = page.getByRole('button', { name: 'Completed' });
  await expect(completeButton.or(completedButton)).toBeVisible();

  if (await completedButton.isVisible()) {
    await expect(completedButton).toBeDisabled();
  }
}

async function verifyLessonFormat(
  browser: Parameters<typeof contextFor>[0],
  api: APIRequestContext,
  format: Format
) {
  const selected = await findLessonByFormat(api, format);
  test.skip(!selected, `No lesson with format "${format}" and the required content is available`);

  const { course, moduleData, detail } = selected!;
  const context = await contextFor(browser, 'learner');

  try {
    const page = await context.newPage();
    await page.goto(
      `/classroom/learner/courses/${course.course.slug}/module/${moduleData.slug}/lessons/${detail.lesson.slug}`
    );

    await expect(
      page.getByRole('heading', { name: detail.content.title, exact: true })
    ).toBeVisible();

    const player = page.locator('mux-player');
    const playButton = page.getByRole('button', { name: 'Play lesson video' });

    if (format === 'video' || format === 'both') {
      await expect(playButton).toBeVisible();
      await expect(page.getByText('Video lesson', { exact: true })).toBeVisible();
      await playButton.click();
      await expect(player).toBeVisible();
    } else {
      await expect(player).toHaveCount(0);
      await expect(page.locator('.prose')).toBeVisible();
    }

    if (format === 'both') {
      await expect(page.locator('.prose')).toBeVisible();
      await expect(player).toBeVisible();
    }

    if (format === 'video') {
      await expect(page.locator('.prose')).toHaveCount(0);
    }

    await verifyCompletionState(page);
  } finally {
    await context.close();
  }
}

test.describe('Learner lesson content blocks', () => {
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

test('teacher-created lesson renders text, video, image and file blocks together', async ({
  browser,
  learnerApi,
}) => {
  const state = readLifecycleState();
  expect(state.moduleSlug).toBeTruthy();
  expect(state.lessonSlug).toBeTruthy();

  const detailResponse = await learnerApi.get(
    `/api/learner/lessons/${encodeURIComponent(state.lessonSlug!)}?courseSlug=${encodeURIComponent(state.courseSlug)}&moduleSlug=${encodeURIComponent(state.moduleSlug!)}`
  );
  expect(detailResponse.ok()).toBeTruthy();
  const detail = (await detailResponse.json()) as LessonDetail;
  const blocks = detail.content?.contentBlocks ?? [];
  const blockTypes = new Set(blocks.map((block) => block._type));

  for (const type of ['textBlock', 'videoBlock', 'imageBlock', 'fileBlock']) {
    expect(blockTypes.has(type), `Lesson API should return ${type}`).toBeTruthy();
  }

  const context = await contextFor(browser, 'learner');
  try {
    const page = await context.newPage();
    await page.goto(
      `/classroom/learner/courses/${encodeURIComponent(state.courseSlug)}/module/${encodeURIComponent(state.moduleSlug!)}/lessons/${encodeURIComponent(state.lessonSlug!)}`
    );

    await expect(
      page.getByRole('heading', { name: state.lessonTitle!, exact: true })
    ).toBeVisible();

    // Text block: the saved Portable Text content is visible.
    await expect(page.getByText(state.textContent!, { exact: true })).toBeVisible();

    // Video block: the video metadata and player launch control render.
    await expect(page.getByRole('heading', { name: state.videoTitle!, exact: true })).toBeVisible();
    const playButton = page.getByRole('button', { name: 'Play lesson video' });
    await expect(playButton).toBeVisible();
    await playButton.click();
    await expect(page.locator('mux-player')).toBeVisible();

    // Image block: alternative text and caption survive the Sanity round trip.
    await expect(page.getByRole('img', { name: state.imageAlt! })).toBeVisible();
    await expect(page.getByText(state.imageCaption!, { exact: true })).toBeVisible();

    // File block: metadata, preview text and download action are rendered.
    await expect(page.getByRole('heading', { name: state.fileTitle!, exact: true })).toBeVisible();
    await expect(page.getByText(state.fileDescription!, { exact: true })).toBeVisible();
    await expect(page.locator('pre')).toContainText(state.fileContent!);
    await expect(page.getByRole('link', { name: 'Download' })).toBeVisible();

    await verifyCompletionState(page);
  } finally {
    await context.close();
  }
});
