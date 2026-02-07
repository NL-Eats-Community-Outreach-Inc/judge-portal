import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { teams, criteria, scores, events, eventJudges } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireAuth();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    // Find all active events the judge is assigned to
    const assignedEvents = await db
      .select({ id: events.id })
      .from(eventJudges)
      .innerJoin(events, eq(eventJudges.eventId, events.id))
      .where(
        and(
          eq(eventJudges.judgeId, user.id),
          eq(events.status, 'active')
        )
      );

    if (assignedEvents.length === 0) {
      return NextResponse.json({ completion: [] });
    }

    // Resolve which event to use
    let resolvedEventId: string;

    if (eventId) {
      const selected = assignedEvents.find((e) => e.id === eventId);
      if (!selected) {
        return NextResponse.json(
          { error: 'You are not assigned to this event', errorType: 'NOT_ASSIGNED' },
          { status: 403 }
        );
      }
      resolvedEventId = eventId;
    } else if (assignedEvents.length === 1) {
      resolvedEventId = assignedEvents[0].id;
    } else {
      return NextResponse.json(
        { error: 'Multiple events available', errorType: 'SELECT_EVENT' },
        { status: 300 }
      );
    }

    // Get all teams for the current event with their award types
    const eventTeams = await db
      .select({
        id: teams.id,
        awardType: teams.awardType,
      })
      .from(teams)
      .where(eq(teams.eventId, resolvedEventId));

    // Get criteria counts by category in a single query
    const criteriaCounts = await db
      .select({
        category: criteria.category,
        count: count(),
      })
      .from(criteria)
      .where(eq(criteria.eventId, resolvedEventId))
      .groupBy(criteria.category);

    // Create a map for quick lookup
    const criteriaCountMap: Record<string, number> = {};
    let totalCriteriaCount = 0;

    for (const row of criteriaCounts) {
      criteriaCountMap[row.category || 'null'] = row.count;
      totalCriteriaCount += row.count;
    }

    // Get all judge scores for this event grouped by team in a single query
    const judgeScoreCounts = await db
      .select({
        teamId: scores.teamId,
        count: count(),
      })
      .from(scores)
      .where(and(eq(scores.judgeId, user.id), eq(scores.eventId, resolvedEventId)))
      .groupBy(scores.teamId);

    // Create a map for quick lookup
    const scoreCountMap: Record<string, number> = {};
    for (const row of judgeScoreCounts) {
      scoreCountMap[row.teamId] = row.count;
    }

    // Calculate completion status for each team using the pre-fetched data
    const completion = eventTeams.map((team) => {
      // Calculate total criteria for this team based on award type
      let totalCriteria: number;
      if (team.awardType === 'technical') {
        totalCriteria = criteriaCountMap['technical'] || 0;
      } else if (team.awardType === 'business') {
        totalCriteria = criteriaCountMap['business'] || 0;
      } else {
        // 'both' - show all criteria
        totalCriteria = totalCriteriaCount;
      }

      const completedCriteria = scoreCountMap[team.id] || 0;

      const completed = completedCriteria === totalCriteria && totalCriteria > 0;
      const partial = completedCriteria > 0 && completedCriteria < totalCriteria;

      return {
        teamId: team.id,
        completed,
        partial,
      };
    });

    return NextResponse.json({ completion });
  } catch (error) {
    console.error('Error fetching completion status:', error);
    return NextResponse.json({ error: 'Failed to fetch completion status' }, { status: 500 });
  }
}
