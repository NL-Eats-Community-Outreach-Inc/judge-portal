import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { loadCountedScores, loadEventCriteria } from '@/lib/db/results';
import { loadEventConflicts } from '@/lib/db/conflicts';
import { computeTeamTotals, computeCriteriaAverages } from '@/lib/results';

export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return sendApiError(400, 'BAD_REQUEST', 'Event ID is required');
    }

    await requireEventInOrg(eventId, orgId);

    const [eventInfo] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (!eventInfo) {
      return sendApiError(404, 'NOT_FOUND', 'Event not found');
    }

    // Keep score calculations unchanged and expose declarations as separate data.
    const [allScores, allCriteria, conflictMap] = await Promise.all([
      loadCountedScores(eventId),
      loadEventCriteria(eventId),
      loadEventConflicts(eventId),
    ]);

    const conflictDeclarations = Array.from(conflictMap, ([key, hasConflict]) => {
      const [teamId, judgeId] = key.split(':');
      return { teamId, judgeId, hasConflict };
    });

    return NextResponse.json({
      event: eventInfo,
      criteriaCount: allCriteria.length,
      allCriteria,
      scores: allScores,
      teamTotals: computeTeamTotals(allScores, allCriteria),
      criteriaAverages: computeCriteriaAverages(allCriteria, allScores),
      conflictDeclarations,
    });
  } catch (error) {
    return handleRouteError(error, 'Error fetching results');
  }
}
