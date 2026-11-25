import { GET } from '@/app/api/teacher/mux/uploads/[uploadId]/route';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockRequest, mockParams } from '@/tests/unit/test-utils/mock-request';
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

const sanityMocks = vi.hoisted(() => ({
  create: vi.fn(),
  patch: vi.fn(),
  commit: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('@/lib/sanity/write-client', () => ({
  sanityWriteClient: {
    delete: sanityMocks.delete,
    transaction: () => ({
      createIfNotExists: (...args: unknown[]) => {
        sanityMocks.create(...args);
        return {
          patch: (...patchArgs: unknown[]) => {
            sanityMocks.patch(...patchArgs);
            return { commit: sanityMocks.commit };
          },
        };
      },
    }),
    patch: vi.fn(),
    assets: { upload: vi.fn() },
  },
}));

const params = mockParams({ uploadId: 'upload-1' });
beforeEach(() => {
  vi.clearAllMocks();
  sanityMocks.commit.mockResolvedValue({});
});
describe('/api/teacher/mux/uploads/[uploadId]', () => {
  it('rejects unauthenticated requests', async () => {
    signOut(auth);
    await expectApiError(
      await GET(mockRequest('/api/teacher/mux/uploads/upload-1'), params),
      401,
      'UNAUTHORIZED'
    );
  });
  it('returns upload status while no asset exists', async () => {
    muxMocks.uploadRetrieve.mockResolvedValue({
      id: 'upload-1',
      status: 'waiting',
      asset_id: null,
    });
    expect(
      await expectJson(await GET(mockRequest('/api/teacher/mux/uploads/upload-1'), params))
    ).toEqual({ status: 'waiting', assetId: null });
    expect(muxMocks.assetRetrieve).not.toHaveBeenCalled();
  });
  it('retrieves the asset and syncs a Sanity asset document', async () => {
    muxMocks.uploadRetrieve.mockResolvedValue({ status: 'asset_created', asset_id: 'asset-1' });
    muxMocks.assetRetrieve.mockResolvedValue({
      id: 'asset-1',
      status: 'ready',
      meta: { title: 'Lecture' },
      playback_ids: [{ id: 'play-1', policy: 'signed' }],
    });
    const body = await expectJson(
      await GET(mockRequest('/api/teacher/mux/uploads/upload-1'), params)
    );
    expect(body).toMatchObject({
      assetId: 'asset-1',
      assetStatus: 'ready',
      playbackId: 'play-1',
      sanityDocumentId: 'mux-video-asset-1',
    });
    expect(sanityMocks.commit).toHaveBeenCalledOnce();
  });
});
