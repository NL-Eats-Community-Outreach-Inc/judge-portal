/**
 * The one browser-side API helper. Every component talks to `/api/*` through
 * `apiFetch`, which parses the JSON envelope and throws `ApiError` carrying the
 * server's own message and code, so toasts show the real reason.
 */

export class ApiError extends Error {
  status: number;
  code: string;
  data: Record<string, unknown>;

  constructor(status: number, code: string, message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  /** Objects are JSON-encoded; strings and other BodyInit values are sent as they are. */
  body?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Parses a JSON body; `null` when there is a body that is not JSON. */
async function parseJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return isPlainObject(parsed) ? parsed : { data: parsed };
  } catch {
    return null;
  }
}

const SESSION_EXPIRED = () =>
  new ApiError(401, 'UNAUTHORIZED', 'Your session has expired. Sign in again.');

/**
 * Every caller is a signed-in page, so an expired session is the only way to
 * reach a 401, a redirect to the login page, or a 2xx that is HTML instead of JSON.
 */
function isExpiredSession(response: Response, data: Record<string, unknown> | null) {
  return response.status === 401 || response.redirected || (response.ok && data === null);
}

/**
 * Fetches a JSON API route. Resolves with the parsed body on 2xx; rejects with
 * `ApiError` on any other status (message from `error` / `error_message`,
 * code from `error_code`), or on a network failure.
 */
export async function apiFetch<T = Record<string, unknown>>(
  url: string,
  init: ApiRequestInit = {}
): Promise<T> {
  const { body, headers, ...rest } = init;
  const requestHeaders = new Headers(headers);
  let requestBody: BodyInit | undefined;

  if (isPlainObject(body) || Array.isArray(body)) {
    requestBody = JSON.stringify(body);
    if (!requestHeaders.has('content-type')) {
      requestHeaders.set('content-type', 'application/json');
    }
  } else if (body !== undefined) {
    requestBody = body as BodyInit;
  }

  let response: Response;
  try {
    response = await fetch(url, { ...rest, headers: requestHeaders, body: requestBody });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  }

  const parsed = await parseJson(response);
  if (isExpiredSession(response, parsed)) {
    throw SESSION_EXPIRED();
  }
  const data = parsed ?? {};

  if (!response.ok) {
    const message =
      (typeof data.error === 'string' && data.error) ||
      (typeof data.error_message === 'string' && data.error_message) ||
      `Request failed (${response.status})`;
    const code = (typeof data.error_code === 'string' && data.error_code) || 'REQUEST_FAILED';
    throw new ApiError(response.status, code, message, data);
  }

  return data as T;
}

/**
 * Fetches a file route (CSV exports). Resolves with the blob and the filename
 * from `Content-Disposition` (if any), or rejects with `ApiError`.
 */
export async function apiDownload(url: string): Promise<{ blob: Blob; filename: string | null }> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  }
  if (response.status === 401 || response.redirected) {
    throw SESSION_EXPIRED();
  }
  if (!response.ok) {
    const data = (await parseJson(response)) ?? {};
    const message =
      (typeof data.error === 'string' && data.error) || `Download failed (${response.status})`;
    const code = (typeof data.error_code === 'string' && data.error_code) || 'REQUEST_FAILED';
    throw new ApiError(response.status, code, message, data);
  }
  const disposition = response.headers.get('content-disposition');
  const filename = disposition?.match(/filename="([^"]*)"/)?.[1] ?? null;
  return { blob: await response.blob(), filename };
}

/** The message to show for any caught error. */
export function messageOf(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
