import { test, expect } from '../../support/fixtures';
import {
  deleteLifecycleState,
  hasLifecycleState,
  readLifecycleState,
  writeLifecycleState,
} from '../support/lifecycle-state';

test('teacher API deletes the lifecycle course and learner access is revoked', async ({
  teacherApi,
  learnerApi,
}) => {
  test.skip(!hasLifecycleState(), 'Teacher setup did not create a lifecycle course');
  const state = readLifecycleState();

  // Recover by the unique title if setup failed after creating the course but
  // before it could persist the redirected slug.
  const coursesResponse = await teacherApi.get('/api/teacher/courses');
  expect(coursesResponse.ok(), 'Teacher course list must be available for cleanup').toBeTruthy();
  const courses = (await coursesResponse.json()) as Array<{ title: string; slug: string }>;
  const targetCourse = courses.find((course) => course.title === state.courseTitle);
  const courseSlug = state.courseSlug || targetCourse?.slug;

  if (!courseSlug) {
    // No course was created. The state file can safely be removed.
    deleteLifecycleState();
    return;
  }

  state.courseSlug = courseSlug;
  writeLifecycleState(state);

  if (targetCourse) {
    const deleteResponse = await teacherApi.delete(
      `/api/teacher/courses/${encodeURIComponent(courseSlug)}`
    );
    expect(
      deleteResponse.ok(),
      `Teacher DELETE should remove ${state.courseTitle}: ${await deleteResponse.text()}`
    ).toBeTruthy();
    const deletion = (await deleteResponse.json()) as { success?: boolean };
    expect(deletion.success).toBe(true);
  }

  const teacherVerify = await teacherApi.get(
    `/api/teacher/courses/${encodeURIComponent(courseSlug)}`
  );
  expect(teacherVerify.status()).toBe(404);

  const learnerCourse = await learnerApi.get(
    `/api/learner/courses/${encodeURIComponent(courseSlug)}`
  );
  expect(learnerCourse.status()).toBe(404);

  const catalogueResponse = await learnerApi.get('/api/learner/catalog');
  expect(catalogueResponse.ok()).toBeTruthy();
  const catalogue = (await catalogueResponse.json()) as Array<{ course: { slug: string } }>;
  expect(catalogue.some((entry) => entry.course.slug === courseSlug)).toBe(false);

  deleteLifecycleState();
});
