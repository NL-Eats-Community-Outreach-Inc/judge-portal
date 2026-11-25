import { POST } from '@/app/api/teacher/assets/image/route';
import { sanityWriteClient } from '@/lib/sanity/write-client';
import { NextRequest } from 'next/server';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
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

vi.mock('@/lib/sanity/write-client', () => ({
  sanityWriteClient: { assets: { upload: vi.fn() } },
}));
const upload = sanityWriteClient.assets.upload as unknown as ReturnType<typeof vi.fn>;

describe('/api/teacher/assets/image', () => {
  it('rejects unauthenticated requests', async () => {
    signOut(auth);
    await expectApiError(
      await POST(
        new NextRequest('http://localhost/api/teacher/assets/image', {
          method: 'POST',
          body: new FormData(),
        })
      ),
      401,
      'UNAUTHORIZED'
    );
  });

  it('rejects unsupported image types', async () => {
    const form = new FormData();
    form.append('file', new File(['x'], 'bad.txt', { type: 'text/plain' }));
    await expectApiError(
      await POST(
        new NextRequest('http://localhost/api/teacher/assets/image', { method: 'POST', body: form })
      ),
      415,
      'UNSUPPORTED_IMAGE_TYPE'
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads an allowed image', async () => {
    const asset = {
      _id: 'image-1',
      _type: 'sanity.imageAsset',
      url: 'https://cdn.sanity.io/images/image-1',
      originalFilename: 'photo.png',
      mimeType: 'image/png',
      size: 4,
    };
    upload.mockResolvedValue(asset);
    const form = new FormData();
    form.append('file', new File(['test'], 'photo.png', { type: 'image/png' }));
    const response = await POST(
      new NextRequest('http://localhost/api/teacher/assets/image', { method: 'POST', body: form })
    );
    expect(response.status).toBe(201);
    expect(await expectJson(response, 201)).toEqual({ asset });
  });
});
