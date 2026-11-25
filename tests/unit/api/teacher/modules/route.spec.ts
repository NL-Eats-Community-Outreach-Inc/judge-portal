import { GET, POST } from '@/app/api/teacher/modules/route';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
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

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('teacher'));
});

const get = (courseSlug = 'course-one') =>
  GET(mockRequest(`/api/teacher/modules?courseSlug=${courseSlug}`));
const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/teacher/modules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

describe('/api/teacher/modules', () => {
  it('rejects unauthenticated requests', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('requires courseSlug', async () => {
    await expectApiError(await GET(mockRequest('/api/teacher/modules')), 400, 'BAD_REQUEST');
  });

  it('lists modules for a course', async () => {
    const modules = [{ id: 'm1', courseId: 'c1' }];
    mockSelectSequence(dbMock.select, [{ id: 'c1' }], modules);
    expect(await expectJson(await get())).toEqual(modules);
  });

  it('returns 404 when the course does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await get(), 404, 'NOT_FOUND');
  });

  it('validates a missing title', async () => {
    await expectApiError(await post({ courseSlug: 'course-one' }), 422, 'VALIDATION_ERROR');
  });
});
