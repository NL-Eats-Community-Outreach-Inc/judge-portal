import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { scores, criteria, teams, events, eventJudges } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

type ResolvedEvent = { ok: true; eventId: string } | { ok: false; response: NextResponse };

// Resolve the active event for this judge (shared by GET and POST)
async function resolveJudgeEvent(userId: string, eventId: string | null): Promise<ResolvedEvent> {
  const assignedEvents = await db
    .select({ id: events.id })
    .from(eventJudges)
    .innerJoin(events, eq(eventJudges.eventId, events.id))
    .where(and(eq(eventJudges.judgeId, userId), eq(events.status, 'active')));

  if (assignedEvents.length === 0) {
    return { ok: false, response: sendApiError(400, 'NO_ACTIVE_EVENT', 'No active event') };
  }

  if (eventId) {
    const selected = assignedEvents.find((e) => e.id === eventId);
    if (!selected) {
      return {
        ok: false,
        response: sendApiError(403, 'NOT_ASSIGNED', 'You are not assigned to this event'),
      };
    }
    return { ok: true, eventId };
  }

  if (assignedEvents.length === 1) {
    return { ok: true, eventId: assignedEvents[0].id };
  }

  return { ok: false, response: sendApiError(400, 'SELECT_EVENT', 'Multiple events available') };
}

export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireJudge();
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const eventId = searchParams.get('eventId');

    if (!teamId) {
      return sendApiError(400, 'BAD_REQUEST', 'Team ID is required');
    }

    const resolved = await resolveJudgeEvent(user.id, eventId);
    if (!resolved.ok) {
      return resolved.response;
    }

    const judgeScores = await db
      .select({
        id: scores.id,
        criterionId: scores.criterionId,
        score: scores.score,
        comment: scores.comment,
      })
      .from(scores)
      .where(
        and(
          eq(scores.judgeId, user.id),
          eq(scores.teamId, teamId),
          eq(scores.eventId, resolved.eventId)
        )
      );

    return NextResponse.json({ scores: judgeScores });
  } catch (error) {
    return handleRouteError(error, 'Error fetching scores');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireJudge();

    let body;
    try {
      body = await request.json();
    } catch {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid JSON in request body');
    }

    const { teamId, criterionId, score, comment, eventId: bodyEventId } = body || {};

    if (!teamId || !criterionId) {
      return sendApiError(400, 'BAD_REQUEST', 'Missing required fields');
    }

    // scores.score is NOT NULL: a comment can only be saved together with a score
    if (!Number.isInteger(score)) {
      return sendApiError(400, 'INVALID_SCORE', 'Score must be a whole number');
    }

    const resolved = await resolveJudgeEvent(user.id, bodyEventId || null);
    if (!resolved.ok) {
      return resolved.response;
    }
    const resolvedEventId = resolved.eventId;

    const [team] = await db
      .select({ id: teams.id, awardType: teams.awardType })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.eventId, resolvedEventId)))
      .limit(1);

    if (!team) {
      return sendApiError(400, 'BAD_REQUEST', 'Team not found in active event');
    }

    const [criterion] = await db
      .select({
        minScore: criteria.minScore,
        maxScore: criteria.maxScore,
        category: criteria.category,
      })
      .from(criteria)
      .where(and(eq(criteria.id, criterionId), eq(criteria.eventId, resolvedEventId)))
      .limit(1);

    if (!criterion) {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid criterion for active event');
    }

    // A technical-only team is never scored on business criteria and vice versa
    if (team.awardType !== 'both' && criterion.category !== team.awardType) {
      return sendApiError(
        400,
        'CRITERION_NOT_APPLICABLE',
        'This criterion does not apply to the team’s award type'
      );
    }

    if (score < criterion.minScore || score > criterion.maxScore) {
      return sendApiError(
        400,
        'INVALID_SCORE',
        `Score must be between ${criterion.minScore} and ${criterion.maxScore}`
      );
    }

    const result = await db
      .insert(scores)
      .values({
        eventId: resolvedEventId,
        judgeId: user.id,
        teamId,
        criterionId,
        score,
        comment: comment || null,
      })
      .onConflictDoUpdate({
        target: [scores.judgeId, scores.teamId, scores.criterionId],
        set: {
          eventId: resolvedEventId,
          score,
          comment: comment || null,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    return NextResponse.json({ success: true, score: result[0] });
  } catch (error) {
    return handleRouteError(error, 'Error saving score');
  }
}
