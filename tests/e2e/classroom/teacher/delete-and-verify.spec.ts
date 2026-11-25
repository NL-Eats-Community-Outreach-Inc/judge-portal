import { test, expect, contextFor } from '../../support/fixtures';
import {
  deleteLifecycleState,
  hasLifecycleState,
  readLifecycleState,
  writeLifecycleState,
} from '../support/lifecycle-state';

test('teacher deletes the lifecycle course and learner access is revoked', async ({
  browser,
  teacherApi,
  learnerApi,
}) => {
  test.skip(!hasLifecycleState(), 'Teacher setup did not create a lifecycle course');
  const state = readLifecycleState();

  const teacherContext = await contextFor(browser, 'teacher');
  try {
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto('/classroom/teacher');
    await expect(teacherPage.getByRole('heading', { name: 'Your courses' })).toBeVisible();

    // Recover the slug by the unique title if setup failed after the create
    // request but before it could persist the redirected URL.
    const coursesResponse = await teacherApi.get('/api/teacher/courses');
    expect(coursesResponse.ok()).toBeTruthy();
    const courses = (await coursesResponse.json()) as Array<{
      title: string;
      slug: string;
    }>;
    const targetCourse = courses.find((course) => course.title === state.courseTitle);
    const courseSlug = state.courseSlug || targetCourse?.slug;

    if (!courseSlug) {
      test.skip(true, 'No lifecycle course was created; there is nothing to delete or verify');
    }

    state.courseSlug = courseSlug!;
    writeLifecycleState(state);

    if (targetCourse) {
      const deleteButton = teacherPage.getByRole('button', {
        name: `Delete course ${state.courseTitle}`,
      });
      await expect(deleteButton).toBeVisible();
      teacherPage.once('dialog', (dialog) => dialog.accept());
      await deleteButton.click();
      await expect(deleteButton).toHaveCount(0);
    }

    const remainingCoursesResponse = await teacherApi.get('/api/teacher/courses');
    expect(remainingCoursesResponse.ok()).toBeTruthy();
    const remainingCourses = (await remainingCoursesResponse.json()) as Array<{
      title: string;
      slug: string;
    }>;
    expect(remainingCourses.some((course) => course.slug === courseSlug)).toBe(false);
  } finally {
    await teacherContext.close();
  }

  // Confirm the learner API no longer resolves the deleted course.
  const courseResponse = await learnerApi.get(
    `/api/learner/courses/${encodeURIComponent(state.courseSlug)}`
  );
  expect(courseResponse.status()).toBe(404);

  const catalogueResponse = await learnerApi.get('/api/learner/catalog');
  expect(catalogueResponse.ok()).toBeTruthy();
  const catalogue = (await catalogueResponse.json()) as Array<{
    course: { slug: string };
  }>;
  expect(catalogue.some((entry) => entry.course.slug === state.courseSlug)).toBe(false);

  // Also verify the learner-facing page handles direct navigation to the old URL.
  const learnerContext = await contextFor(browser, 'learner');
  try {
    const learnerPage = await learnerContext.newPage();
    await learnerPage.goto(`/classroom/learner/courses/${encodeURIComponent(state.courseSlug)}`);
    await expect(learnerPage.getByRole('heading', { name: 'Unable to load course' })).toBeVisible();
    await expect(learnerPage.getByRole('alert')).toContainText('Course not found');
  } finally {
    await learnerContext.close();
  }

  deleteLifecycleState();
});
