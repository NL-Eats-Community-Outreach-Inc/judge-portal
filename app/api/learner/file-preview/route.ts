import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

const MAX_PREVIEW_BYTES = 10 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * Proxies Sanity file assets for in-browser previews.
 * Browser fetch() cannot always read Sanity's asset response cross-origin,
 * even though navigating to the same URL for a download works.
 */
export async function GET(request: Request) {
  try {
    await authServer.requireAnyRole(['learner', 'teacher']);

    const { searchParams } = new URL(request.url);
    const assetUrl = searchParams.get('url');

    if (!assetUrl) {
      return sendApiError(400, 'BAD_REQUEST', 'Missing file URL');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(assetUrl);
    } catch {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid file URL');
    }

    // Only proxy HTTPS Sanity CDN file assets.
    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname !== 'cdn.sanity.io' ||
      (parsedUrl.port !== '' && parsedUrl.port !== '443') ||
      !parsedUrl.pathname.startsWith('/files/') ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return sendApiError(400, 'BAD_REQUEST', 'Unsupported file URL');
    }

    const upstream = await fetch(parsedUrl.toString(), {
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Accept: [...ALLOWED_CONTENT_TYPES].join(', '),
      },
    });

    if (!upstream.ok || !upstream.body) {
      return sendApiError(
        502,
        'UPSTREAM_FILE_ERROR',
        'The file could not be retrieved from storage'
      );
    }

    // Never trust the upstream content type for inline browser rendering.
    const contentType = (upstream.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      await upstream.body.cancel();

      return sendApiError(415, 'UNSUPPORTED_FILE_TYPE', 'This file type cannot be previewed');
    }

    // Reject oversized files before reading their contents when possible.
    const contentLength = upstream.headers.get('content-length');

    if (contentLength !== null) {
      const size = Number(contentLength);

      if (!Number.isSafeInteger(size) || size < 0) {
        await upstream.body.cancel();

        return sendApiError(
          502,
          'INVALID_UPSTREAM_SIZE',
          'The storage service returned an invalid file size'
        );
      }

      if (size > MAX_PREVIEW_BYTES) {
        await upstream.body.cancel();

        return sendApiError(413, 'FILE_TOO_LARGE', 'Files larger than 10 MB cannot be previewed');
      }
    }

    // Enforce the limit while reading, even if Content-Length is missing
    // or inaccurate.
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        totalBytes += value.byteLength;

        if (totalBytes > MAX_PREVIEW_BYTES) {
          await reader.cancel();

          return sendApiError(413, 'FILE_TOO_LARGE', 'Files larger than 10 MB cannot be previewed');
        }

        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    // Combine the bounded chunks into one response body.
    const file = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
      file.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const headers = new Headers({
      'Content-Type':
        contentType === 'text/plain'
          ? 'text/plain; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=60',
      'Content-Length': String(totalBytes),
    });

    return new Response(file, { status: 200, headers });
  } catch (error) {
    return handleRouteError(error, 'Error proxying learner file preview');
  }
}
