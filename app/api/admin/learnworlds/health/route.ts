/**
 * Admin LearnWorlds Ingestion Health Endpoint
 * GET /api/admin/learnworlds/health
 *
 * Returns the current health and staleness status of the LearnWorlds ingestion pipeline.
 * Access is restricted to users with the admin role.
 */

import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { getIngestionHealthStatus } from '@/lib/learnworlds/health';
import { sendApiError } from '@/lib/utils/api-errors';

export async function GET() {
  try {
    const user = await getUserFromSession();

    // Only admins can access this endpoint
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query the database for the latest ingestion run status
    const healthReport = await getIngestionHealthStatus();

    // Determine the HTTP status code based on health.
    // 200 OK for healthy/stale, 503 Service Unavailable if actively failing
    const httpStatus = healthReport.status === 'failing' ? 503 : 200;

    return NextResponse.json(healthReport, { status: httpStatus });
  } catch (error) {
    console.error('Failed to retrieve ingestion health:', error);
    return sendApiError(
      500,
      'INTERNAL_SERVER_ERROR',
      'Failed to calculate ingestion health status.'
    );
  }
}
