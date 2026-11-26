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

const MAX_PREVIEW_BYTES = 10 * 1024 * 1024;

const get = (url?: string) =>
  GET(
    new Request(
      `http://localhost/api/learner/file-preview${url ? `?url=${encodeURIComponent(url)}` : ''}`
    )
  );

const sanityFileUrl = 'https://cdn.sanity.io/files/project/dataset/lesson-notes.txt';

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

    await expectApiError(await get(sanityFileUrl), 401, 'UNAUTHORIZED');
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

    await expectApiError(
      await get('https://cdn.sanity.io:8443/files/project/dataset/file.txt'),
      400,
      'BAD_REQUEST'
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies a supported text file and applies safe response headers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('lesson notes', {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'content-length': '12',
        },
      })
    );

    const response = await get(sanityFileUrl);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('lesson notes');
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe('private, max-age=60');
    expect(response.headers.get('content-length')).toBe('12');

    expect(fetchMock).toHaveBeenCalledWith(
      sanityFileUrl,
      expect.objectContaining({
        cache: 'no-store',
        redirect: 'error',
        headers: {
          Accept:
            'text/plain, application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      })
    );
  });

  it('proxies a supported DOCX file', async () => {
    const docxContent = new Uint8Array([80, 75, 3, 4, 1, 2, 3]);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(docxContent, {
        status: 200,
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'content-length': String(docxContent.byteLength),
        },
      })
    );

    const response = await get('https://cdn.sanity.io/files/project/dataset/lesson.docx');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    expect(new Uint8Array(await response.arrayBuffer())).toEqual(docxContent);
  });

  it('rejects unsupported upstream content types', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<script>alert("xss")</script>', {
        status: 200,
        headers: {
          'content-type': 'text/html',
        },
      })
    );

    await expectApiError(await get(sanityFileUrl), 415, 'UNSUPPORTED_FILE_TYPE');

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects files larger than 10 MiB using Content-Length', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('oversized file', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
          'content-length': String(MAX_PREVIEW_BYTES + 1),
        },
      })
    );

    await expectApiError(await get(sanityFileUrl), 413, 'FILE_TOO_LARGE');
  });

  it('rejects files larger than 10 MiB when Content-Length is missing', async () => {
    const oversizedChunk = new Uint8Array(MAX_PREVIEW_BYTES + 1);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(oversizedChunk);
            controller.close();
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'text/plain',
          },
        }
      )
    );

    await expectApiError(await get(sanityFileUrl), 413, 'FILE_TOO_LARGE');
  });

  it('rejects invalid upstream Content-Length values', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('lesson notes', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
          'content-length': 'invalid',
        },
      })
    );

    await expectApiError(await get(sanityFileUrl), 502, 'INVALID_UPSTREAM_SIZE');
  });

  it('returns 502 when Sanity cannot provide a readable file body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 404,
      })
    );

    await expectApiError(
      await get('https://cdn.sanity.io/files/project/dataset/missing.txt'),
      502,
      'UPSTREAM_FILE_ERROR'
    );
  });
});
