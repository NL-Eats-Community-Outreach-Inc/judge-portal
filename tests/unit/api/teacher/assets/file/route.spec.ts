import { POST } from '@/app/api/teacher/assets/file/route';
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

describe('/api/teacher/assets/file', () => {
  it('rejects unauthenticated requests', async () => {
    signOut(auth);
    const form = new FormData();
    await expectApiError(
      await POST(
        new NextRequest('http://localhost/api/teacher/assets/file', { method: 'POST', body: form })
      ),
      401,
      'UNAUTHORIZED'
    );
  });

  it('requires a file', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/teacher/assets/file', {
        method: 'POST',
        body: new FormData(),
      })
    );
    await expectApiError(response, 400, 'MISSING_FILE');
  });

  it('uploads a file to Sanity', async () => {
    const asset = {
      _id: 'file-1',
      _type: 'sanity.fileAsset',
      url: 'https://cdn.sanity.io/files/file-1',
      originalFilename: 'notes.pdf',
      mimeType: 'application/pdf',
      size: 4,
    };
    upload.mockResolvedValue(asset);
    const form = new FormData();
    form.append('file', new File(['test'], 'notes.pdf', { type: 'application/pdf' }));
    const response = await POST(
      new NextRequest('http://localhost/api/teacher/assets/file', { method: 'POST', body: form })
    );
    expect(response.status).toBe(201);
    expect(await expectJson(response, 201)).toEqual({ asset });
  });
});
