import { NextRequest } from 'next/server';

/**
Build a NextRequest for unit-testing App Router route handlers directly
 */
export function mockRequest(
  url: string,
  init?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): NextRequest {
  const absoluteUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;

  const headers = new Headers(init?.headers);
  let body: string | undefined;
  if (init?.body !== undefined) {
    body = typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  return new NextRequest(absoluteUrl, {
    method: init?.method ?? 'GET',
    headers,
    body,
  });
}

/**
Build the `{ params: Promise<...> }` second argument Next.js 15 route
 */
export function mockParams<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}
