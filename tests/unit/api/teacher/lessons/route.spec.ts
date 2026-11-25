import { GET, POST } from '@/app/api/teacher/lessons/route';
import { sanityWriteClient } from '@/lib/sanity/write-client';

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

vi.mock('@/lib/sanity/write-client', () => ({
  sanityWriteClient: { create: vi.fn(), delete: vi.fn(), assets: { upload: vi.fn() } },
}));
const sanity = sanityWriteClient as unknown as {
  create: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
const get = () =>
  GET(mockRequest('/api/teacher/lessons?courseSlug=course-one&moduleSlug=module-one'));
const post = (body: unknown) =>
  POST(
    mockRequest('/api/teacher/lessons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

describe('/api/teacher/lessons', () => {
  it('rejects unauthenticated requests', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('requires both courseSlug and moduleSlug', async () => {
    await expectApiError(await GET(mockRequest('/api/teacher/lessons')), 400, 'BAD_REQUEST');
  });

  it('lists lessons for a module', async () => {
    const lessons = [{ id: 'l1', moduleId: 'm1' }];
    mockSelectSequence(dbMock.select, [{ id: 'm1' }], lessons);
    expect(await expectJson(await get())).toEqual({ lessons });
  });

  it('validates missing lesson title', async () => {
    await expectApiError(
      await post({ courseSlug: 'course-one', moduleSlug: 'module-one' }),
      400,
      'INVALID_TITLE'
    );
  });

  it('creates the Sanity document and database lesson', async () => {
    const created = { id: 'l1', title: 'Welcome', slug: 'welcome' };
    mockSelectSequence(dbMock.select, [{ id: 'm1' }], []);
    sanity.create.mockResolvedValue({ _id: 'sanity-l1' });
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([created]) }),
    } as never);
    const response = await post({
      courseSlug: 'course-one',
      moduleSlug: 'module-one',
      title: 'Welcome',
    });
    expect(response.status).toBe(201);
    expect(await expectJson(response, 201)).toEqual({
      lesson: created,
      sanityDocumentId: 'sanity-l1',
    });
  });
});
