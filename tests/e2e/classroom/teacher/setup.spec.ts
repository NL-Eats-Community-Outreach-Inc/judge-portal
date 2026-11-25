import { test, expect, contextFor } from '../../support/fixtures';
import {
  deleteLifecycleState,
  writeLifecycleState,
  type ClassroomLifecycleState,
} from '../support/lifecycle-state';

const imagePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGOsWHCCgYGBiYGBgYGBAQAWWgHksUzpDAAAAABJRU5ErkJggg==',
  'base64'
);

function blockCard(page: import('@playwright/test').Page, heading: string) {
  return page
    .locator('section.rounded-xl')
    .filter({ has: page.getByRole('heading', { name: heading, exact: true }) })
    .last();
}

async function addBlock(page: import('@playwright/test').Page, label: string) {
  await page.getByRole('button', { name: /Add additional content/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${label}\\b`) }).click();
}

test('teacher creates a course, module, lesson and all supported content blocks', async ({
  browser,
  teacherApi,
  learnerApi,
}) => {
  // Never let a stale state file from a previous interrupted run point teardown
  // at an unrelated course. This run owns only the course it creates below.
  deleteLifecycleState();

  // Use an existing ready Mux asset so the test exercises the real video
  // selection and learner playback-token flow without uploading a large video.
  const muxResponse = await teacherApi.get('/api/teacher/mux/assets?limit=100');
  expect(muxResponse.ok(), 'Teacher Mux asset library must be available').toBeTruthy();
  const muxPayload = (await muxResponse.json()) as {
    assets?: Array<{
      id: string;
      title: string | null;
      status: string;
      playbackId: string | null;
    }>;
  };
  const videoAsset = muxPayload.assets?.find(
    (asset) => asset.status === 'ready' && Boolean(asset.playbackId)
  );
  expect(
    videoAsset,
    'The E2E Mux account needs at least one ready asset with a playback ID. Add a reusable test video to the Mux library.'
  ).toBeTruthy();

  const runId = Date.now().toString(36);
  const state: ClassroomLifecycleState = {
    courseTitle: `E2E Classroom Lifecycle ${runId}`,
    courseSlug: '',
    moduleTitle: `Lifecycle Module ${runId}`,
    lessonTitle: `All Content Blocks ${runId}`,
    textContent: `E2E text block content ${runId}`,
    videoTitle: `E2E Video Block ${runId}`,
    videoAssetId: videoAsset!.id,
    imageAlt: `E2E classroom image ${runId}`,
    imageCaption: `E2E image caption ${runId}`,
    fileTitle: `E2E Lesson Notes ${runId}`,
    fileDescription: `Downloadable notes for ${runId}`,
    fileContent: `E2E file preview content ${runId}`,
  };

  const context = await contextFor(browser, 'teacher');

  try {
    const page = await context.newPage();
    await page.goto('/classroom/teacher');
    await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible();

    await page.getByRole('button', { name: 'Create course', exact: true }).first().click();
    await page.getByLabel('Course title').fill(state.courseTitle);
    await page
      .getByLabel('Description')
      .fill('Created automatically by the classroom lifecycle E2E suite.');
    // Persist the unique title before submitting. If navigation fails after the
    // POST succeeds, teardown can still find and remove the course by title.
    writeLifecycleState(state);
    await page.getByRole('button', { name: 'Create course', exact: true }).last().click();

    await expect(page).toHaveURL(/\/classroom\/teacher\/courses\/[^/]+$/);
    state.courseSlug = decodeURIComponent(page.url().split('/').pop()!);
    writeLifecycleState(state);

    await page.getByRole('button', { name: 'Add module' }).click();
    await page.getByLabel('Module title').fill(state.moduleTitle!);
    await page
      .getByPlaceholder('What does this module cover?')
      .fill('Module created by the classroom lifecycle E2E suite.');
    await page.getByRole('button', { name: 'Create module' }).click();

    const moduleToggle = page
      .locator('button[aria-expanded]')
      .filter({ hasText: state.moduleTitle! })
      .first();
    await expect(moduleToggle).toBeVisible();
    if ((await moduleToggle.getAttribute('aria-expanded')) !== 'true') {
      await moduleToggle.click();
    }

    const moduleResponse = await teacherApi.get(
      `/api/teacher/modules?courseSlug=${encodeURIComponent(state.courseSlug)}`
    );
    expect(moduleResponse.ok()).toBeTruthy();
    const modules = (await moduleResponse.json()) as Array<{ title: string; slug: string }>;
    const createdModule = modules.find((module) => module.title === state.moduleTitle);
    expect(createdModule, 'The teacher-created module should be returned by the API').toBeTruthy();
    state.moduleSlug = createdModule!.slug;
    writeLifecycleState(state);

    await page.getByRole('button', { name: 'Add lesson' }).click();
    await page.getByPlaceholder('e.g. What is engineering?').fill(state.lessonTitle!);
    await page
      .getByPlaceholder('A short lesson summary')
      .fill('A complete lesson containing text, video, image and file blocks.');
    await page.getByRole('button', { name: 'Create lesson' }).click();

    const lessonLink = page
      .locator(`a[href^="/classroom/teacher/courses/${state.courseSlug}/module/"]`)
      .filter({ hasText: state.lessonTitle! });
    await expect(lessonLink).toBeVisible();
    const lessonHref = await lessonLink.getAttribute('href');
    expect(lessonHref).toBeTruthy();
    const lessonSegments = new URL(lessonHref!, 'http://localhost').pathname.split('/');
    state.moduleSlug = decodeURIComponent(lessonSegments[6]);
    state.lessonSlug = decodeURIComponent(lessonSegments[8]);
    writeLifecycleState(state);

    await lessonLink.click();
    await expect(page.getByRole('heading', { name: 'Edit lesson' })).toBeVisible();

    // The editor starts with one empty text block. Populate it rather than
    // adding a second text block, then add the other three supported types.
    const textEditor = page.locator('[contenteditable="true"]').first();
    await expect(textEditor).toBeVisible();
    await textEditor.fill(state.textContent!);

    await addBlock(page, 'Video');
    const videoCard = blockCard(page, 'Video');
    await videoCard.getByLabel('Video title').fill(state.videoTitle!);
    await videoCard.getByLabel('Description').fill('Video block created by the E2E suite.');
    await videoCard.getByRole('button', { name: 'Choose from video library' }).click();
    const videoDialog = page.getByRole('dialog');
    await expect(videoDialog.getByRole('heading', { name: 'Choose a video' })).toBeVisible();
    const videoLabel = videoAsset!.title || videoAsset!.id;
    const videoChoice = videoDialog.getByRole('button').filter({ hasText: videoLabel }).first();
    await expect(videoChoice).toBeEnabled();
    await videoChoice.click();
    await expect(videoCard).toContainText(`Selected: mux-video-${videoAsset!.id}`);

    await addBlock(page, 'Image');
    const imageCard = blockCard(page, 'Image');
    await imageCard.getByLabel('Alternative text').fill(state.imageAlt!);
    await imageCard.getByLabel('Caption').fill(state.imageCaption!);
    await imageCard.locator('input[type="file"]').setInputFiles({
      name: 'e2e-classroom-image.png',
      mimeType: 'image/png',
      buffer: imagePng,
    });
    await expect(page.getByRole('status')).toContainText('Image uploaded and attached.');
    await expect(imageCard).toContainText('Image attached');

    await addBlock(page, 'File');
    const fileCard = blockCard(page, 'File');
    await fileCard.getByLabel('Display name').fill(state.fileTitle!);
    await fileCard.getByLabel('Description').fill(state.fileDescription!);
    await fileCard.locator('input[type="file"]').setInputFiles({
      name: 'e2e-lesson-notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(state.fileContent!, 'utf8'),
    });
    await expect(page.getByRole('status')).toContainText('File uploaded and attached.');
    await expect(fileCard).toContainText('Attached: e2e-lesson-notes.txt');

    await page.getByRole('button', { name: 'Save lesson' }).click();
    await expect(page.getByText('Lesson saved successfully.')).toBeVisible();

    const lessonResponse = await learnerApi.get(
      `/api/learner/lessons/${encodeURIComponent(state.lessonSlug!)}?courseSlug=${encodeURIComponent(state.courseSlug)}&moduleSlug=${encodeURIComponent(state.moduleSlug!)}`
    );
    expect(
      lessonResponse.ok(),
      'Learners should be able to retrieve the created lesson'
    ).toBeTruthy();
    const lessonPayload = (await lessonResponse.json()) as {
      lesson: { id: string };
      content: {
        contentBlocks?: Array<{
          _key: string;
          _type: string;
          video?: { asset?: { playbackId?: string | null } };
        }>;
      };
    };
    const blocks = lessonPayload.content.contentBlocks ?? [];
    const blockTypes = new Set(blocks.map((block) => block._type));
    for (const type of ['textBlock', 'videoBlock', 'imageBlock', 'fileBlock']) {
      expect(blockTypes.has(type), `Saved lesson should contain ${type}`).toBeTruthy();
    }

    const savedVideo = blocks.find((block) => block._type === 'videoBlock');
    expect(
      savedVideo?.video?.asset?.playbackId,
      'The selected video must resolve to a Mux playback ID'
    ).toBeTruthy();

    const tokenResponse = await learnerApi.get(
      `/api/learner/video-token?lessonId=${encodeURIComponent(lessonPayload.lesson.id)}&blockKey=${encodeURIComponent(savedVideo!._key)}`
    );
    expect(
      tokenResponse.ok(),
      'The learner video-token endpoint should authorize the selected asset'
    ).toBeTruthy();

    state.lessonId = lessonPayload.lesson.id;
    writeLifecycleState(state);
  } finally {
    await context.close();
  }
});
