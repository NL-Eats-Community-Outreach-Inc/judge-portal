import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/learner/catalog/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  buildDbMock,
  mockSelectSequence,
  resetDbMock,
  type DbMock,
} from '@/tests/unit/test-utils/mock-db';
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

const course1 = {
  id: 'course-1',
  title: 'Introduction to Programming',
  description: 'Learn programming basics',
};

const course2 = {
  id: 'course-2',
  title: 'Advanced Programming',
  describe: 'Explore advanced topics',
};

const module1 = {
  id: 'module-1',
  courseId: 'course-1',
  title: 'getting Started',
};

const module2 = {
  id: 'module-2',
  courseId: 'course-1',
  title: 'Variables',
};

const module3 = {
  id: 'module-3',
  courseId: 'course-2',
  title: 'Advanced Concepts',
};

const lesson1 = {
  id: 'lesson-1',
  moduleId: 'module-1',
  title: 'Your First Program',
};

const lesson2 = {
  id: 'lesson-2',
  moduleId: 'module-2',
  title: 'Working with Variables',
};

const lesson3 = {
  id: 'lesson-3',
  moduleId: 'module-3',
  title: 'Advanced Functions',
};

const get = () => GET();

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('learner'));
});

describe('GET /api/learner/catalog', () => {
  it('returns 401 when unauthenticated', async () => {
    signOut(auth);

    await expectApiError(await get(), 401, 'BAD_REQUEST');

    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('returns all courses with their modules and lessons grouped correctly', async () => {
    mockSelectSequence(
      dbMock.select,
      [course1, course2],
      [module1, module2, module3],
      [lesson1, lesson2, lesson3]
    );

    const response = await get();

    expect(await expectJson(response)).toEqual([
      {
        course: course1,
        modules: [module1, module2],
        lessons: [lesson1, lesson2],
      },
      {
        course: course2,
        modules: [module3],
        lessons: [lesson3],
      },
    ]);
  });

  it('returns an empty array when there are no courses', async () => {
    mockSelectSequence(dbMock.select, []);

    const response = await get();

    expect(dbMock.select).toHaveBeenCalledTimes(1);
    expect(await expectJson(response)).toEqual([]);
  });

  it('returns courses with empty module and lesson arrays when there are no modules', async () => {
    mockSelectSequence(dbMock.select, [course1], []);

    const response = await get();

    expect(await expectJson(response)).toEqual([
      {
        course: course1,
        modules: [],
        lessons: [],
      },
    ]);
  });

  it('returns modules with empty lesson arrays when there are no lessons', async () => {
    mockSelectSequence(dbMock.select, [course1], [module1, module2], []);

    const response = await get();

    expect(await expectJson(response)).toEqual([
      {
        course: course1,
        modules: [module1, module2],
        lessons: [],
      },
    ]);
  });

  it('does not associate lessons with the wrong course', async () => {
    mockSelectSequence(
      dbMock.select,
      [course1, course2],
      [module1, module3],
      [
        lesson1,
        lesson3,
        { id: 'lesson-invalid', moduleId: 'module-not-in-catalog', title: 'Invalid Lesson' },
      ]
    );

    const response = await get();

    expect(await expectJson(response)).toEqual([
      {
        course: course1,
        modules: [module1],
        lessons: [lesson1],
      },
      {
        course: course2,
        modules: [module3],
        lessons: [lesson3],
      },
    ]);
  });

  it('returns an empty catalogue when courses have no modules or lessons', async () => {
    mockSelectSequence(dbMock.select, [course1], []);

    const response = await get();

    expect(await expectJson(response)).toEqual([
      {
        course: course1,
        modules: [],
        lessons: [],
      },
    ]);
  });
});
