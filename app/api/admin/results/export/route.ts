import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { csvRow, csvAttachment } from '@/lib/utils/csv';
import { loadCountedScores, loadEventCriteria } from '@/lib/db/results';
import { loadEventConflicts } from '@/lib/db/conflicts';
import { computeTeamTotals, rankTeamTotals, scoreForMode, formatAwardType } from '@/lib/results';
import type { ScoreMode } from '@/lib/types';

const SCORE_MODES: readonly ScoreMode[] = ['total', 'average', 'weighted'];
const AWARD_TYPE_FILTERS = ['all', 'technical', 'business', 'both'] as const;

const SCORE_MODE_LABEL: Record<ScoreMode, string> = {
  total: 'Total Score',
  average: 'Average Score',
  weighted: 'Weighted Score',
};

export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const scoreModeParam = searchParams.get('scoreMode') || 'total';
    const awardTypeFilter = searchParams.get('awardTypeFilter') || 'all';

    if (!eventId) {
      return sendApiError(400, 'BAD_REQUEST', 'Event ID is required');
    }

    if (!(SCORE_MODES as readonly string[]).includes(scoreModeParam)) {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid score mode');
    }
    const scoreMode = scoreModeParam as ScoreMode;

    if (!(AWARD_TYPE_FILTERS as readonly string[]).includes(awardTypeFilter)) {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid award type filter');
    }

    await requireEventInOrg(eventId, orgId);

    const [eventResult] = await db
      .select({ name: events.name })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    const eventName = eventResult?.name || 'event';

    // Scores and conflict declarations are loaded separately; declarations never affect scoring.
    const [allScores, allCriteria, conflictMap] = await Promise.all([
      loadCountedScores(eventId),
      loadEventCriteria(eventId),
      loadEventConflicts(eventId),
    ]);

    const conflictCountsByTeam = new Map<string, number>();
    for (const [key, hasConflict] of conflictMap) {
      if (!hasConflict) continue;
      const teamId = key.split(':')[0];
      conflictCountsByTeam.set(teamId, (conflictCountsByTeam.get(teamId) ?? 0) + 1);
    }

    let teamTotals = computeTeamTotals(allScores, allCriteria);
    if (awardTypeFilter !== 'all') {
      teamTotals = teamTotals.filter((team) => team.awardType === awardTypeFilter);
    }
    const ranked = rankTeamTotals(teamTotals, scoreMode);

    const lines = [
      `Rank,Tied,Team Name,Award Type,Presentation Order,${SCORE_MODE_LABEL[scoreMode]},Number of Scores,Judge Count,Declared Conflicts`,
      ...ranked.map((team) => {
        const teamConflictCount = conflictCountsByTeam.get(team.teamId) ?? 0;

        return csvRow([
          team.rank,
          team.tied ? 'yes' : '',
          team.teamName,
          formatAwardType(team.awardType),
          team.presentationOrder,
          scoreForMode(team, scoreMode),
          team.totalScores,
          team.judgeCount,
          teamConflictCount,
        ]);
      }),
    ];
    const csvContent = lines.join('\n') + '\n';

    const headers = new Headers();
    headers.set('Content-Type', 'text/csv');
    headers.set('Content-Disposition', csvAttachment('judging-results', eventName, scoreMode));

    return new NextResponse(csvContent, { headers });
  } catch (error) {
    return handleRouteError(error, 'Error exporting results');
  }
}
