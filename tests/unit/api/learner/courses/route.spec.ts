import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/learner/courses/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';

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

const get = () => GET();

const courses = [
  {
    id: 'course-1',
    title: 'Introduction to Programming',
    slug: 'introduction-to-programming',
  },
  {
    id: 'course-2',
    title: 'Web Development',
    slug: 'web-development',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('learner'));
});

describe('GET /api/learner/courses', () => {
  it('returns 401 when unauthenticated', async () => {
    signOut(auth);

    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('returns the available courses', async () => {
    mockSelectSequence(dbMock.select, courses);

    const response = await get();

    expect(await expectJson(response)).toEqual(courses);
  });

  it('returns 401 when unauthenticated', async () => {
    signOut(auth);

    await expectApiError(await get(), 401, 'UNAUTHORIZED');

    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('returns an empty array when there are no courses', async () => {
    mockSelectSequence(dbMock.select, []);

    const response = await get();

    expect(await expectJson(response)).toEqual([]);
  });

  it('handles database errors', async () => {
    dbMock.select.mockImplementation(() => {
      throw new Error('Database unavailable');
    });

    const response = await get();

    await expectApiError(response, 500, 'INTERNAL_SERVER_ERROR');
  });
});
