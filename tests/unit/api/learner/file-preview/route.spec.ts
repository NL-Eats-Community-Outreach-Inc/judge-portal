import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/learner/file-preview/route';
import { authServer } from '@/lib/auth';
import {
  fakeUser,
  signInAs,
  signOut,
  expectApiError,
  type AuthServerMock,
} from '@/tests/unit/test-utils/route-harness';

vi.mock('@/lib/auth', async () => {
  const { buildAuthServerMock } = await import('@/tests/unit/test-utils/route-harness');
  return { authServer: buildAuthServerMock() };
});

const auth = authServer as unknown as AuthServerMock;

const get = (url?: string) =>
  GET(
    new Request(
      `http://localhost/api/learner/file-preview${url ? `?url=${encodeURIComponent(url)}` : ''}`
    )
  );

beforeEach(() => {
  vi.clearAllMocks();
  signInAs(auth, fakeUser('learner'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/learner/file-preview', () => {
  it('returns 401 when unauthenticated', async () => {
    signOut(auth);

    await expectApiError(
      await get('https://cdn.sanity.io/files/project/dataset/file.txt'),
      401,
      'UNAUTHORIZED'
    );
  });

  it('returns 400 when the URL is missing', async () => {
    await expectApiError(await get(), 400, 'BAD_REQUEST');
  });

  it('returns 400 for malformed or unsupported URLs without making an upstream request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expectApiError(await get('not-a-url'), 400, 'BAD_REQUEST');
    await expectApiError(await get('https://example.com/files/file.txt'), 400, 'BAD_REQUEST');
    await expectApiError(
      await get('http://cdn.sanity.io/files/project/dataset/file.txt'),
      400,
      'BAD_REQUEST'
    );
    await expectApiError(
      await get('https://cdn.sanity.io/images/project/dataset/file.jpg'),
      400,
      'BAD_REQUEST'
    );
    await expectApiError(
      await get('https://user:pass@cdn.sanity.io/files/project/dataset/file.txt'),
      400,
      'BAD_REQUEST'
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies a supported Sanity file and applies safe response headers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('lesson notes', {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'content-length': '12',
        },
      })
    );

    const response = await get('https://cdn.sanity.io/files/project/dataset/lesson-notes.txt');

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('lesson notes');
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe('private, max-age=60');
    expect(response.headers.get('content-length')).toBe('12');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://cdn.sanity.io/files/project/dataset/lesson-notes.txt',
      expect.objectContaining({
        cache: 'no-store',
        redirect: 'error',
      })
    );
  });

  it('returns an upstream error when Sanity cannot provide a readable file body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 404,
      })
    );

    await expectApiError(
      await get('https://cdn.sanity.io/files/project/dataset/missing.txt'),
      500,
      'UPSTREAM_FILE_ERROR'
    );
  });
});
