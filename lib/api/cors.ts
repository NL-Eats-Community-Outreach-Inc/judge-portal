import { NextRequest } from 'next/server';

export function getLearnworldsCorsHeaders(request: NextRequest): Record<string, string> {
  const allowedOrigin = process.env.LEARNWORLDS_ALLOWED_ORIGIN;
  const requestOrigin = request.headers.get('origin');
  const origin = allowedOrigin && requestOrigin === allowedOrigin ? allowedOrigin : undefined;

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
