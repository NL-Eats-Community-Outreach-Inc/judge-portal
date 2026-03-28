import { NextResponse } from 'next/server';

/**
 * FR-14: Basic Error Handling
 * The system shall validate API inputs and return appropriate HTTP status codes (400, 404, 500) with structured JSON error messages.
      Return HTTP 400 for malformed or incomplete requests
      Return HTTP 404 for non-existent resources
      Return HTTP 500 for unexpected server errors

 */
export function sendApiError(
  status: 400 | 404 | 500,
  errorCode: string,
  errorMessage: string
) {
  return NextResponse.json(
    {
      error_code: errorCode,
      error_message: errorMessage,
    },
    { status }
  );
}