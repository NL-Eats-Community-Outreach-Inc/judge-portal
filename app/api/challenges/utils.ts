import { NextRequest } from 'next/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function getCorsHeaders(request: NextRequest): HeadersInit {
  const allowedOrigin = process.env.LEARNWORLDS_ALLOWED_ORIGIN;
  const requestOrigin = request.headers.get('origin');
  const origin = allowedOrigin && requestOrigin === allowedOrigin ? allowedOrigin : undefined;

  return {
    'Access-Control-Allow-Origin': origin || '',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
