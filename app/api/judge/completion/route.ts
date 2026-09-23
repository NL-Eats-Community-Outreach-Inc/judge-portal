import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { teams, criteria, scores, events, eventJudges } from '@/lib/db/schema';
import { eq, and, count, or, sql } from 'drizzle-orm';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireJudge();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    // Find all active events the judge is assigned to
    const assignedEvents = await db
      .select({ id: events.id })
      .from(eventJudges)
      .innerJoin(events, eq(eventJudges.eventId, events.id))
      .where(and(eq(eventJudges.judgeId, user.id), eq(events.status, 'active')));

    if (assignedEvents.length === 0) {
      return NextResponse.json({ completion: [] });
    }

    let resolvedEventId: string;

    if (eventId) {
      const selected = assignedEvents.find((e) => e.id === eventId);
      if (!selected) {
        return sendApiError(403, 'NOT_ASSIGNED', 'You are not assigned to this event');
      }
      resolvedEventId = eventId;
    } else if (assignedEvents.length === 1) {
      resolvedEventId = assignedEvents[0].id;
    } else {
      return sendApiError(400, 'SELECT_EVENT', 'Multiple events available');
    }

    const eventTeams = await db
      .select({ id: teams.id, awardType: teams.awardType })
      .from(teams)
      .where(eq(teams.eventId, resolvedEventId));

    const criteriaCounts = await db
      .select({ category: criteria.category, count: count() })
      .from(criteria)
      .where(eq(criteria.eventId, resolvedEventId))
      .groupBy(criteria.category);

    const criteriaCountMap: Record<string, number> = {};
    let totalCriteriaCount = 0;
    for (const row of criteriaCounts) {
      criteriaCountMap[row.category] = row.count;
      totalCriteriaCount += row.count;
    }

    // Count only the rows whose criterion applies to the team's award type, so a
    // stray score on a non-applicable criterion never pushes a team past "complete"
    const judgeScoreCounts = await db
      .select({ teamId: scores.teamId, count: count() })
      .from(scores)
      .innerJoin(criteria, eq(scores.criterionId, criteria.id))
      .innerJoin(teams, eq(scores.teamId, teams.id))
      .where(
        and(
          eq(scores.judgeId, user.id),
          eq(scores.eventId, resolvedEventId),
          or(
            eq(teams.awardType, 'both'),
            sql`${criteria.category}::text = ${teams.awardType}::text`
          )
        )
      )
      .groupBy(scores.teamId);

    const scoreCountMap: Record<string, number> = {};
    for (const row of judgeScoreCounts) {
      scoreCountMap[row.teamId] = row.count;
    }

    const completion = eventTeams.map((team) => {
      const totalCriteria =
        team.awardType === 'both' ? totalCriteriaCount : criteriaCountMap[team.awardType] || 0;

      const completedCriteria = scoreCountMap[team.id] || 0;

      const completed = completedCriteria >= totalCriteria && totalCriteria > 0;
      const partial = completedCriteria > 0 && completedCriteria < totalCriteria;

      return { teamId: team.id, completed, partial };
    });

    return NextResponse.json({ completion });
  } catch (error) {
    return handleRouteError(error, 'Error fetching completion status');
  }
}
