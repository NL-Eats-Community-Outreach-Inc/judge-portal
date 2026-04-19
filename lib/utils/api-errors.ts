import { NextResponse } from 'next/server';

/**
 * FR-14: Basic Error Handling
 * The system shall validate API inputs and return appropriate HTTP status codes with structured JSON error messages.

 */
export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500;

export function sendApiError(status: ApiErrorStatus, errorCode: string, errorMessage: string) {
  return NextResponse.json({ error_code: errorCode, error_message: errorMessage }, { status });
}