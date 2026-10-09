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
  },
  {
    id: 'course-2',
    title: 'Web Development',
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

    await expectApiError(await get(), 401, 'BAD_REQUEST');
  });

  it('returns the available courses', async () => {
    mockSelectSequence(dbMock.select, courses);

    const response = await get();

    expect(await expectJson(response)).toEqual(courses);
  });

  it('returns an empty array when there are no courses', async () => {
    mockSelectSequence(dbMock.select, []);

    const response = await get();

    expect(await expectJson(response)).toEqual([]);
  });
});
