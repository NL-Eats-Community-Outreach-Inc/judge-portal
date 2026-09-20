import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, apiDownload, ApiError, messageOf } from '@/lib/api/client';

/** A response the way the browser sees a login redirect: HTML, 2xx, `redirected`. */
function redirectedHtml() {
  const response = new Response('<!doctype html><title>Login</title>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
  Object.defineProperty(response, 'redirected', { value: true });
  return response;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('resolves the JSON body on 2xx and sends objects as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ team: { id: 't1' } }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/x', { method: 'POST', body: { name: 'a' } })).resolves.toEqual({
      team: { id: 't1' },
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe('{"name":"a"}');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('throws ApiError with the envelope message and code on a non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({ error: 'Nope', error_code: 'BAD_REQUEST', error_message: 'Nope' }, 400)
        )
    );
    const error = await apiFetch('/api/x').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'BAD_REQUEST', message: 'Nope' });
  });

  it('treats a redirect to the login page as an expired session, not an empty result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(redirectedHtml()));
    const error = await apiFetch('/api/judge/teams').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(messageOf(error)).toMatch(/session has expired/i);
  });

  it('treats a 401 envelope as an expired session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(
          {
            error: 'Authentication required',
            error_code: 'UNAUTHORIZED',
            error_message: 'Authentication required',
          },
          401
        )
      )
    );
    const error = await apiFetch('/api/judge/teams').catch((e) => e);
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(messageOf(error)).toMatch(/session has expired/i);
  });

  it('treats a 2xx body that is not JSON as an expired session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<!doctype html>', { status: 200 }))
    );
    await expect(apiFetch('/api/judge/teams')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('accepts an empty 2xx body (bodiless success)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiFetch('/api/x', { method: 'DELETE' })).resolves.toEqual({});
  });

  it('throws NETWORK_ERROR when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});

describe('apiDownload', () => {
  it('returns the blob and the filename from Content-Disposition', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('a,b\n1,2\n', {
          status: 200,
          headers: {
            'content-type': 'text/csv',
            'content-disposition': 'attachment; filename="judging-results.csv"',
          },
        })
      )
    );
    const { blob, filename } = await apiDownload('/api/admin/results/export?eventId=e1');
    expect(filename).toBe('judging-results.csv');
    expect(await blob.text()).toBe('a,b\n1,2\n');
  });

  it('treats a redirect to the login page as an expired session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(redirectedHtml()));
    await expect(apiDownload('/api/admin/results/export?eventId=e1')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });
});
