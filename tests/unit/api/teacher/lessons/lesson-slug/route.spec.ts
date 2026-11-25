import { GET, PATCH } from '@/app/api/teacher/lessons/[lessonSlug]/route';
import { sanityServerClient } from '@/lib/sanity/server-client';

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('teacher'));
});

vi.mock('@/lib/sanity/server-client', () => ({ sanityServerClient: { fetch: vi.fn() } }));
vi.mock('@/lib/sanity/write-client', () => ({
  sanityWriteClient: { patch: vi.fn(), delete: vi.fn() },
}));
const sanityFetch = sanityServerClient.fetch as unknown as ReturnType<typeof vi.fn>;
const params = mockParams({ lessonSlug: 'welcome' });
const req = (method: string, body?: unknown) =>
  mockRequest('/api/teacher/lessons/welcome?courseSlug=course-one&moduleSlug=module-one', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('/api/teacher/lessons/[lessonSlug]', () => {
  it('rejects unauthenticated requests', async () => {
    signOut(auth);
    await expectApiError(await GET(req('GET'), params), 401, 'UNAUTHORIZED');
  });

  it('returns 404 when lesson is not found in scope', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await GET(req('GET'), params), 404, 'LESSON_NOT_FOUND');
  });

  it('returns lesson and Sanity content', async () => {
    const lesson = { id: 'l1', sanityDocumentId: 'sanity-l1' };
    const content = { _id: 'sanity-l1', contentBlocks: [] };
    mockSelectSequence(dbMock.select, [{ lesson }]);
    sanityFetch.mockResolvedValue(content);
    expect(await expectJson(await GET(req('GET'), params))).toEqual({ lesson, content });
  });

  it('rejects invalid contentBlocks on patch', async () => {
    mockSelectSequence(dbMock.select, [{ lesson: { id: 'l1', sanityDocumentId: 'sanity-l1' } }]);
    await expectApiError(
      await PATCH(req('PATCH', { contentBlocks: 'not-array' }), params),
      400,
      'INVALID_CONTENT_BLOCKS'
    );
  });
});
