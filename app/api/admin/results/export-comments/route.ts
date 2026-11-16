import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { events, judgeTeamConflicts, teams, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { csvRow, csvAttachment } from '@/lib/utils/csv';
import { loadCountedScores } from '@/lib/db/results';
import { loadEventConflicts } from '@/lib/db/conflicts';
import { formatAwardType } from '@/lib/results';

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

    // Counted score rows, declarations, and event name are loaded independently.
    const [allScores, eventResult, conflictMap, declarationDetails] = await Promise.all([
      loadCountedScores(eventId),
      db.select({ name: events.name }).from(events).where(eq(events.id, eventId)).limit(1),
      loadEventConflicts(eventId),
      db
        .select({
          teamId: judgeTeamConflicts.teamId,
          teamName: teams.name,
          presentationOrder: teams.presentationOrder,
          awardType: teams.awardType,
          judgeId: judgeTeamConflicts.judgeId,
          judgeEmail: users.email,
          hasConflict: judgeTeamConflicts.hasConflict,
        })
        .from(judgeTeamConflicts)
        .innerJoin(teams, eq(teams.id, judgeTeamConflicts.teamId))
        .innerJoin(users, eq(users.id, judgeTeamConflicts.judgeId))
        .where(eq(judgeTeamConflicts.eventId, eventId)),
    ]);

    const rows = [...allScores].sort(
      (a, b) =>
        a.team.presentationOrder - b.team.presentationOrder ||
        a.judge.email.localeCompare(b.judge.email) ||
        a.criterion.displayOrder - b.criterion.displayOrder
    );

    const lines = [
      'Presentation Order,Team,Award Type,Judge,Conflict of Interest,Criterion,Score,Comment',
      ...rows.map((row) => {
        const conflict = conflictMap.get(`${row.team.id}:${row.judge.id}`);
        return csvRow([
          row.team.presentationOrder,
          row.team.name,
          formatAwardType(row.team.awardType),
          row.judge.email,
          conflict === undefined ? 'Not declared' : conflict ? 'Yes' : 'No',
          row.criterion.name,
          row.score,
          row.comment ?? '',
        ]);
      }),
    ];

    // Include declarations for judge/team pairs with no counted score rows.
    const scoredPairs = new Set(rows.map((row) => `${row.team.id}:${row.judge.id}`));
    const unscoredDeclarations = declarationDetails
      .filter((declaration) => !scoredPairs.has(`${declaration.teamId}:${declaration.judgeId}`))
      .sort(
        (a, b) =>
          a.presentationOrder - b.presentationOrder || a.judgeEmail.localeCompare(b.judgeEmail)
      );

    for (const declaration of unscoredDeclarations) {
      lines.push(
        csvRow([
          declaration.presentationOrder,
          declaration.teamName,
          formatAwardType(declaration.awardType),
          declaration.judgeEmail,
          declaration.hasConflict ? 'Yes' : 'No',
          '',
          '',
          '',
        ])
      );
    }

    const csvContent = lines.join('\n') + '\n';
    const eventName = eventResult[0]?.name || 'event';

    const headers = new Headers();
    headers.set('Content-Type', 'text/csv');
    headers.set('Content-Disposition', csvAttachment('judging-comments', eventName));

    return new NextResponse(csvContent, { headers });
  } catch (error) {
    return handleRouteError(error, 'Error exporting comments');
  }
}
