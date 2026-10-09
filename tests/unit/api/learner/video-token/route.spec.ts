import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/learner/video-token/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { sanityClient } from '@/lib/sanity/client';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';
import {
  signInAs,
  signOut,
  fakeUser,
  expectApiError,
  expectJson,
  type AuthServerMock,
} from '@/tests/unit/test-utils/route-harness';

const { signPlaybackId } = vi.hoisted(() => ({
  signPlaybackId: vi.fn(),
}));

vi.mock('@mux/mux-node', () => ({
  default: class MockMux {
    jwt = {
      signPlaybackId,
    };
  },
}));

vi.mock('@/lib/auth', async () => {
  const { buildAuthServerMock } = await import('@/tests/unit/test-utils/route-harness');
  return { authServer: buildAuthServerMock() };
});

vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});

vi.mock('@/lib/sanity/client', () => ({
  sanityClient: {
    fetch: vi.fn(),
  },
}));

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;
const sanityFetch = sanityClient.fetch as unknown as ReturnType<typeof vi.fn>;

const get = (query = '?lessonId=lesson-1') =>
  GET(new Request(`http://localhost/api/learner/video-token${query}`));

const lesson = {
  sanityDocumentId: 'sanity-lesson-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  sanityFetch.mockReset();
  signPlaybackId.mockReset();

  signInAs(auth, fakeUser('learner'));
});

describe('GET /api/learner/video-token', () => {
  it('returns 401 when unauthenticated', async () => {
    signOut(auth);

    await expectApiError(await get(), 401, 'BAD_REQUEST');
  });

  it('returns 400 when lessonId is missing', async () => {
    await expectApiError(await get(''), 400, 'BAD_REQUEST');
  });

  it('returns 404 when the lesson does not exist', async () => {
    mockSelectSequence(dbMock.select, []);

    await expectApiError(await get(), 404, 'NOT_FOUND');

    expect(sanityFetch).not.toHaveBeenCalled();
    expect(signPlaybackId).not.toHaveBeenCalled();
  });

  it('returns 404 when lesson content is not configured', async () => {
    mockSelectSequence(dbMock.select, [{ sanityDocumentId: null }]);

    await expectApiError(await get(), 404, 'NOT_FOUND');

    expect(sanityFetch).not.toHaveBeenCalled();
  });

  it('returns 404 when the lesson has no playback ID', async () => {
    mockSelectSequence(dbMock.select, [lesson]);
    sanityFetch.mockResolvedValue({ playbackId: null });

    await expectApiError(await get(), 404, 'NOT_FOUND');

    expect(signPlaybackId).not.toHaveBeenCalled();
  });

  it('returns a signed playback token for a configured video', async () => {
    mockSelectSequence(dbMock.select, [lesson]);

    sanityFetch.mockResolvedValue({
      playbackId: 'mux-playback-123',
    });

    signPlaybackId.mockResolvedValue('mock-signed-token');

    const response = await get();

    expect(await expectJson(response)).toEqual({
      token: 'mock-signed-token',
      playbackId: 'mux-playback-123',
    });

    expect(signPlaybackId).toHaveBeenCalledWith('mux-playback-123', { type: 'video' });
  });
});
