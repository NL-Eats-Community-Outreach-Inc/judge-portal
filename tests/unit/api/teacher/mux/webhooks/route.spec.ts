import { POST } from '@/app/api/teacher/mux/webhooks/route';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import { resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';
import {
  fakeUser,
  signInAs,
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

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MUX_WEBHOOK_SECRET = 'test-secret';
  sanityMocks.commit.mockResolvedValue({});
});
describe('/api/teacher/mux/webhooks', () => {
  it('returns a configuration error without a webhook secret', async () => {
    delete process.env.MUX_WEBHOOK_SECRET;
    await expectApiError(
      await POST(mockRequest('/api/teacher/mux/webhooks', { method: 'POST', body: '{}' })),
      500,
      'WEBHOOK_CONFIGURATION_ERROR'
    );
  });
  it('rejects invalid webhook signatures', async () => {
    muxMocks.webhookUnwrap.mockRejectedValue(new Error('invalid signature'));
    await expectApiError(
      await POST(mockRequest('/api/teacher/mux/webhooks', { method: 'POST', body: '{}' })),
      401,
      'INVALID_WEBHOOK_SIGNATURE'
    );
  });
  it('synchronizes a ready asset', async () => {
    muxMocks.webhookUnwrap.mockResolvedValue({
      type: 'video.asset.ready',
      data: { id: 'asset-1' },
    });
    muxMocks.assetRetrieve.mockResolvedValue({
      id: 'asset-1',
      status: 'ready',
      meta: { title: 'Lesson' },
      playback_ids: [{ id: 'play-1', policy: 'signed' }],
    });
    expect(
      await expectJson(
        await POST(mockRequest('/api/teacher/mux/webhooks', { method: 'POST', body: '{}' }))
      )
    ).toEqual({ received: true, eventType: 'video.asset.ready' });
    expect(sanityMocks.commit).toHaveBeenCalledOnce();
  });
  it('marks deleted assets without deleting their Sanity document', async () => {
    muxMocks.webhookUnwrap.mockResolvedValue({
      type: 'video.asset.deleted',
      data: { id: 'asset-2' },
    });
    await POST(mockRequest('/api/teacher/mux/webhooks', { method: 'POST', body: '{}' }));
    expect(sanityMocks.patch).toHaveBeenCalled();
    expect(sanityMocks.delete).not.toHaveBeenCalled();
  });
});
