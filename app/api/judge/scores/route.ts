import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { scores, criteria, teams, events, eventJudges } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Helper: resolve the event for this judge (shared by GET and POST)
async function resolveJudgeEvent(userId: string, eventId: string | null) {
  const assignedEvents = await db
    .select({ id: events.id })
    .from(eventJudges)
    .innerJoin(events, eq(eventJudges.eventId, events.id))
    .where(
      and(
        eq(eventJudges.judgeId, userId),
        eq(events.status, 'active')
      )
    );

  if (assignedEvents.length === 0) {
    return { error: 'No active event', status: 400, resolvedEventId: null };
  }

  if (eventId) {
    const selected = assignedEvents.find((e) => e.id === eventId);
    if (!selected) {
      return { error: 'NOT_ASSIGNED', status: 403, resolvedEventId: null };
    }
    return { error: null, status: 200, resolvedEventId: eventId };
  }

  if (assignedEvents.length === 1) {
    return { error: null, status: 200, resolvedEventId: assignedEvents[0].id };
  }

  return { error: 'SELECT_EVENT', status: 300, resolvedEventId: null };
}

export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireAuth();
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const eventId = searchParams.get('eventId');

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const { error, status, resolvedEventId } = await resolveJudgeEvent(user.id, eventId);
    if (!resolvedEventId) {
      if (error === 'NOT_ASSIGNED') {
        return NextResponse.json(
          { error: 'You are not assigned to this event', errorType: 'NOT_ASSIGNED' },
          { status }
        );
      }
      if (error === 'SELECT_EVENT') {
        return NextResponse.json(
          { error: 'Multiple events available', errorType: 'SELECT_EVENT' },
          { status }
        );
      }
      return NextResponse.json({ error }, { status });
    }

    // Get all scores for this judge and team in the resolved event
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
          eq(scores.eventId, resolvedEventId)
        )
      );

    return NextResponse.json({ scores: judgeScores });
  } catch (error) {
    console.error('Error fetching scores:', error);
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireAuth();

    // Check if request has content
    const contentLength = request.headers.get('content-length');
    if (!contentLength || contentLength === '0') {
      return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { teamId, criterionId, score, comment, eventId: bodyEventId } = body || {};

    // Validate required fields
    if (!teamId || !criterionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error: resolveError, status: resolveStatus, resolvedEventId } =
      await resolveJudgeEvent(user.id, bodyEventId || null);
    if (!resolvedEventId) {
      if (resolveError === 'NOT_ASSIGNED') {
        return NextResponse.json(
          { error: 'You are not assigned to this event', errorType: 'NOT_ASSIGNED' },
          { status: resolveStatus }
        );
      }
      if (resolveError === 'SELECT_EVENT') {
        return NextResponse.json(
          { error: 'Multiple events available', errorType: 'SELECT_EVENT' },
          { status: resolveStatus }
        );
      }
      return NextResponse.json({ error: resolveError }, { status: resolveStatus });
    }

    // Verify the team belongs to the resolved event
    const team = await db
      .select({
        id: teams.id,
        eventId: teams.eventId,
      })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.eventId, resolvedEventId)))
      .limit(1);

    if (!team.length) {
      return NextResponse.json({ error: 'Team not found in active event' }, { status: 400 });
    }

    // Get the criterion to validate score range and ensure it belongs to the event
    const criterion = await db
      .select({
        minScore: criteria.minScore,
        maxScore: criteria.maxScore,
        eventId: criteria.eventId,
      })
      .from(criteria)
      .where(and(eq(criteria.id, criterionId), eq(criteria.eventId, resolvedEventId)))
      .limit(1);

    if (!criterion.length) {
      return NextResponse.json({ error: 'Invalid criterion for active event' }, { status: 400 });
    }

    // Additional validation: ensure team and criterion belong to same event
    if (team[0].eventId !== criterion[0].eventId) {
      return NextResponse.json(
        { error: 'Team and criterion must belong to the same event' },
        { status: 400 }
      );
    }

    // Validate score range only if score is provided
    if (
      score !== null &&
      score !== undefined &&
      (score < criterion[0].minScore || score > criterion[0].maxScore)
    ) {
      return NextResponse.json(
        { error: `Score must be between ${criterion[0].minScore} and ${criterion[0].maxScore}` },
        { status: 400 }
      );
    }

    // Insert or update score
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

    return NextResponse.json({
      success: true,
      score: result[0],
    });
  } catch (error) {
    console.error('Error saving score:', error);
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
  }
}
