import { NextResponse } from 'next/server';
import { getUniqueViolation } from '@/lib/db/errors';

/**
 * FR-14: Basic Error Handling
 * The system shall validate API inputs and return appropriate HTTP status codes with structured JSON error messages.
 */
export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500;

/**
 * Error envelope for every API route. `error` carries the human-readable message so
 * client code that reads `data.error` shows the real reason; `error_code` is the
 * machine-readable code; `error_message` is kept for readers of the older shape.
 * `extra` adds fields the client acts on (for example `redirectUrl`); it can
 * never override the three envelope keys.
 */
export function sendApiError(
  status: ApiErrorStatus,
  errorCode: string,
  errorMessage: string,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { ...extra, error: errorMessage, error_code: errorCode, error_message: errorMessage },
    { status }
  );
}

/**
 * Errors thrown by the auth and participant helpers, keyed by their message.
 * Every route's `catch` ends with `return handleRouteError(error, 'context')`.
 */
const KNOWN_ERRORS: Record<string, { status: ApiErrorStatus; code: string; message: string }> = {
  NOT_MEMBER: { status: 403, code: 'NOT_MEMBER', message: 'You are not a member of this team' },
  NOT_CREATOR: {
    status: 403,
    code: 'NOT_CREATOR',
    message: 'Only the team creator can do this',
  },
  TEAM_NOT_FOUND: { status: 404, code: 'TEAM_NOT_FOUND', message: 'Team not found' },
  EVENT_NOT_OPEN: {
    status: 400,
    code: 'EVENT_NOT_OPEN',
    message: 'This action is only available while the event is open',
  },
  NOT_REGISTERED: {
    status: 400,
    code: 'NOT_REGISTERED',
    message: 'You must register for this event first',
  },
};

/**
 * Translates any error thrown inside a route into the error envelope:
 * auth helper errors → 401/403, org scoping → 403/404, participant codes → as
 * listed above, unique violations → 409, anything else → logged 500.
 */
export function handleRouteError(error: unknown, context: string) {
  if (error instanceof Error) {
    if (error.name === 'OrphanedAdminError') {
      return sendApiError(
        403,
        'NO_ORGANIZATION',
        'Your account is not assigned to an organization'
      );
    }
    if (error.message === 'Authentication required') {
      return sendApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    if (/ role required$/.test(error.message)) {
      return sendApiError(403, 'FORBIDDEN', 'You do not have access to this resource');
    }
    if (error.message.includes('does not belong')) {
      return sendApiError(404, 'NOT_FOUND', error.message);
    }
    // hasOwn: a thrown `Error('constructor')` must not find Object.prototype
    if (Object.hasOwn(KNOWN_ERRORS, error.message)) {
      const known = KNOWN_ERRORS[error.message];
      return sendApiError(known.status, known.code, known.message);
    }
  }

  if (getUniqueViolation(error)) {
    return sendApiError(409, 'CONFLICT', 'This record already exists');
  }

  console.error(`${context}:`, error);
  return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
}
