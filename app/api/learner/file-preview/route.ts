import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

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

    // Only proxy Sanity CDN file assets. This prevents the endpoint from
    // becoming a general-purpose server-side request forgery proxy.
    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname !== 'cdn.sanity.io' ||
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
        Accept:
          'text/plain, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/octet-stream',
      },
    });

    if (!upstream.ok || !upstream.body) {
      return sendApiError(
        500,
        'UPSTREAM_FILE_ERROR',
        'The file could not be retrieved from storage'
      );
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=60',
    });

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    return handleRouteError(error, 'Error proxying learner file preview');
  }
}
