import { GET, PATCH } from '@/app/api/teacher/modules/[moduleSlug]/route';

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

const params = mockParams({ moduleSlug: 'module-one' });
const req = (method: string, body?: unknown) =>
  new Request('http://localhost/api/teacher/modules/module-one?courseSlug=course-one', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('/api/teacher/modules/[moduleSlug]', () => {
  it('rejects unauthenticated requests', async () => {
    signOut(auth);
    await expectApiError(await GET(req('GET'), params), 401, 'UNAUTHORIZED');
  });

  it('returns 404 when module is not found in course scope', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await GET(req('GET'), params), 404, 'NOT_FOUND');
  });

  it('returns a module and its lessons', async () => {
    const moduleData = { id: 'm1', slug: 'module-one' };
    const lessons = [{ id: 'l1', moduleId: 'm1' }];
    mockSelectSequence(dbMock.select, [{ module: moduleData }], lessons);
    expect(await expectJson(await GET(req('GET'), params))).toEqual({
      module: moduleData,
      lessons,
    });
  });

  it('rejects invalid title updates', async () => {
    mockSelectSequence(dbMock.select, [{ module: { id: 'm1', courseId: 'c1' } }]);
    await expectApiError(await PATCH(req('PATCH', { title: '' }), params), 422, 'VALIDATION_ERROR');
  });
});
