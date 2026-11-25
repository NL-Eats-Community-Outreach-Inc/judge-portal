import { POST } from '@/app/api/teacher/mux/uploads/route';

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

beforeEach(() => vi.clearAllMocks());
describe('/api/teacher/mux/uploads', () => {
  it('rejects unauthenticated requests', async () => {
    signOut(auth);
    await expectApiError(
      await POST(mockRequest('/api/teacher/mux/uploads', { method: 'POST', body: '{}' })),
      401,
      'UNAUTHORIZED'
    );
  });
  it('creates a signed direct upload', async () => {
    muxMocks.uploadCreate.mockResolvedValue({
      id: 'upload-1',
      url: 'https://upload.mux.com/one',
      status: 'waiting',
    });
    const response = await POST(
      mockRequest('/api/teacher/mux/uploads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: ' Demo ' }),
      })
    );
    expect(response.status).toBe(201);
    expect(await expectJson(response, 201)).toEqual({
      uploadId: 'upload-1',
      uploadUrl: 'https://upload.mux.com/one',
      status: 'waiting',
    });
    expect(muxMocks.uploadCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        new_asset_settings: expect.objectContaining({
          meta: { title: 'Demo' },
          playback_policies: ['signed'],
        }),
      })
    );
  });
});
