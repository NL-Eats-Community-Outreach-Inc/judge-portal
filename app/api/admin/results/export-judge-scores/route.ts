import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { teams, users, events, eventJudges } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { csvRow, csvAttachment } from '@/lib/utils/csv';
import { loadCountedScores, loadEventCriteria } from '@/lib/db/results';
import { criterionApplies, formatAwardType } from '@/lib/results';

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

    // Counted rows only (assigned judges, applicable criteria), same as the dashboard
    const [allScores, allCriteria, allTeams, allJudges, eventResult] = await Promise.all([
      loadCountedScores(eventId),
      loadEventCriteria(eventId),
      db
        .select({
          id: teams.id,
          name: teams.name,
          presentationOrder: teams.presentationOrder,
          awardType: teams.awardType,
        })
        .from(teams)
        .where(eq(teams.eventId, eventId))
        .orderBy(teams.presentationOrder),
      db
        .select({ id: users.id, email: users.email })
        .from(users)
        .innerJoin(eventJudges, eq(eventJudges.judgeId, users.id))
        .where(eq(eventJudges.eventId, eventId))
        .orderBy(users.email),
      db.select({ name: events.name }).from(events).where(eq(events.id, eventId)).limit(1),
    ]);

    // score by team → judge → criterion
    const scoreMatrix = new Map<string, number>();
    for (const row of allScores) {
      scoreMatrix.set(`${row.team.id}:${row.judge.id}:${row.criterion.id}`, row.score);
    }

    // Row 1: team columns, then the judge's email local part repeated per criterion.
    // Row 2: the criterion name and maximum under each judge.
    const headerRow1: Array<string | number> = ['Team Name', 'Presentation Order', 'Award Type'];
    const headerRow2: Array<string | number> = ['', '', ''];
    for (const judge of allJudges) {
      for (const criterion of allCriteria) {
        headerRow1.push(judge.email.split('@')[0]);
        headerRow2.push(`${criterion.name} (/${criterion.maxScore})`);
      }
    }

    const lines = [csvRow(headerRow1), csvRow(headerRow2)];

    // One row per team: integer score, blank when not scored, N/A when the
    // criterion does not apply to the team's award type
    for (const team of allTeams) {
      const row: Array<string | number> = [
        team.name,
        team.presentationOrder,
        formatAwardType(team.awardType),
      ];
      for (const judge of allJudges) {
        for (const criterion of allCriteria) {
          if (!criterionApplies(team.awardType, criterion.category)) {
            row.push('N/A');
            continue;
          }
          const score = scoreMatrix.get(`${team.id}:${judge.id}:${criterion.id}`);
          row.push(score === undefined ? '' : score);
        }
      }
      lines.push(csvRow(row));
    }

    const csvContent = lines.join('\n') + '\n';

    const eventName = eventResult[0]?.name || 'event';

    const headers = new Headers();
    headers.set('Content-Type', 'text/csv');
    headers.set('Content-Disposition', csvAttachment('judge-scores-matrix', eventName));

    return new NextResponse(csvContent, { headers });
  } catch (error) {
    return handleRouteError(error, 'Error exporting judge scores');
  }
}
