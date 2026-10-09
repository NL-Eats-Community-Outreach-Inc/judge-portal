import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/learner/courses/[courseId]/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockRequest, mockParams } from '@/tests/unit/test-utils/mock-request';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';
import {
  fakeUser,
  signInAs,
  signOut,
  expectApiError,
  expectJson,
  type AuthServerMock,
} from '@/tests/unit/test-utils/route-harness';

vi.mock('@/lib/auth', async () => {
  const { buildAuthServerMock } = await import('@/tests/unit/test-utils/route-harness');
  return { authServer: buildAuthServerMock() };
});

vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;

const params = mockParams({ courseId: 'course-1' });

const get = () => GET(mockRequest('/api/learner/courses/course-1'), params);

const course = {
  id: 'course-1',
  title: 'Introduction to Programming',
};

const modules = [
  {
    id: 'module-1',
    courseId: 'course-1',
    title: 'Getting Started',
  },
];

const lessons = [
  {
    id: 'lesson-1',
    moduleId: 'module-1',
    title: 'Your First Program',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('learner'));
});

describe('GET /api/learner/courses/[courseId]', () => {
  it('returns 401 when unauthenticated', async () => {
    signOut(auth);

    await expectApiError(await get(), 401, 'BAD_REQUEST');
  });

  it('returns 404 when the course does not exist', async () => {
    mockSelectSequence(dbMock.select, []);

    await expectApiError(await get(), 404, 'NOT_FOUND');
  });

  it('returns the course, its modules, and its lessons', async () => {
    mockSelectSequence(dbMock.select, [course], modules, lessons);

    const response = await get();

    expect(await expectJson(response)).toEqual({
      course,
      modules,
      lessons,
    });
  });

  it('returns empty module and lesson arrays for a course with no modules', async () => {
    mockSelectSequence(dbMock.select, [course], [], []);

    const response = await get();

    expect(await expectJson(response)).toEqual({
      course,
      modules: [],
      lessons: [],
    });
  });
});
