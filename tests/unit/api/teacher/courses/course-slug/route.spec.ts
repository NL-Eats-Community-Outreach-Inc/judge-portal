import { GET, PATCH } from '@/app/api/teacher/courses/[courseSlug]/route';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockParams } from '@/tests/unit/test-utils/mock-request';
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

vi.mock('@/lib/sanity/write-client', () => ({
  sanityWriteClient: { create: vi.fn(), delete: vi.fn(), assets: { upload: vi.fn() } },
}));

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('teacher'));
});

const params = mockParams({ courseSlug: 'course-one' });
const request = (body?: unknown) =>
  new Request('http://localhost/api/teacher/courses/course-one', {
    method: body === undefined ? 'GET' : 'PATCH',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('/api/teacher/courses/[courseSlug]', () => {
  it('rejects unauthenticated requests', async () => {
    signOut(auth);
    await expectApiError(await GET(request(), params), 401, 'UNAUTHORIZED');
  });

  it('returns course, modules, and lessons', async () => {
    const course = { id: 'c1', slug: 'course-one' };
    const modules = [{ id: 'm1', courseId: 'c1' }];
    const lessons = [{ id: 'l1', moduleId: 'm1' }];
    mockSelectSequence(dbMock.select, [course], modules, lessons);
    expect(await expectJson(await GET(request(), params))).toEqual({ course, modules, lessons });
  });

  it('returns 404 for an unknown course', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await GET(request(), params), 404, 'NOT_FOUND');
  });

  it('rejects an empty patch', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'c1', slug: 'course-one' }]);
    await expectApiError(await PATCH(request({}), params), 400, 'BAD_REQUEST');
  });
});
