import { GET } from '@/app/api/teacher/mux/assets/route';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import { resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';
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

const muxMocks = vi.hoisted(() => ({
  assetsList: vi.fn(),
  uploadCreate: vi.fn(),
  uploadRetrieve: vi.fn(),
  assetRetrieve: vi.fn(),
  signPlaybackId: vi.fn(),
  webhookUnwrap: vi.fn(),
}));
vi.mock('@/lib/mux/client', () => ({
  mux: {
    video: {
      assets: { list: muxMocks.assetsList, retrieve: muxMocks.assetRetrieve },
      uploads: { create: muxMocks.uploadCreate, retrieve: muxMocks.uploadRetrieve },
    },
    jwt: { signPlaybackId: muxMocks.signPlaybackId },
    webhooks: { unwrap: muxMocks.webhookUnwrap },
  },
}));

interface MuxAssetsResponse {
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
  assets: Array<{
    id: string;
    playbackId: string | null;
    thumbnailUrl: string | null;
  }>;
}

beforeEach(() => vi.clearAllMocks());
describe('/api/teacher/mux/assets', () => {
  it('rejects unauthenticated requests', async () => {
    signOut(auth);
    await expectApiError(await GET(mockRequest('/api/teacher/mux/assets')), 401, 'UNAUTHORIZED');
  });
  it('validates the limit', async () => {
    await expectApiError(
      await GET(mockRequest('/api/teacher/mux/assets?limit=101')),
      400,
      'INVALID_LIMIT'
    );
  });
  it('returns a page of Mux assets', async () => {
    muxMocks.assetsList.mockResolvedValue({
      data: [
        {
          id: 'asset-1',
          status: 'ready',
          playback_ids: [{ id: 'play-1', policy: 'public' }],
          tracks: [],
        },
      ],
      next_cursor: 'next',
    });
    const body = (await expectJson(
      await GET(mockRequest('/api/teacher/mux/assets?limit=10'))
    )) as MuxAssetsResponse;
    expect(body.pagination).toEqual({ nextCursor: 'next', hasMore: true, limit: 10 });
    expect(body.assets[0]).toMatchObject({
      id: 'asset-1',
      playbackId: 'play-1',
      thumbnailUrl: 'https://image.mux.com/play-1/thumbnail.jpg?time=5&width=640&height=360',
    });
  });
});
