import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { judgeTeamConflicts, teams, events, eventJudges } from '@/lib/db/schema';
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

type RouteContext = {
  params: Promise<{ teamId: string }>;
};

// GET: Retrieve this judge's conflict declaration for a team.
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await authServer.requireJudge();
    const { teamId } = await context.params;

    const { searchParams } = new URL(request.url);
    const resolved = await resolveJudgeEvent(user.id, searchParams.get('eventId'));

    if (!resolved.ok) {
      return resolved.response;
    }

    // Ensure this team belongs to the judge's active event.
    const [team] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.eventId, resolved.eventId)))
      .limit(1);

    if (!team) {
      return sendApiError(404, 'TEAM_NOT_FOUND', 'Team not found in active event');
    }

    const [declaration] = await db
      .select({
        hasConflict: judgeTeamConflicts.hasConflict,
        updatedAt: judgeTeamConflicts.updatedAt,
      })
      .from(judgeTeamConflicts)
      .where(
        and(
          eq(judgeTeamConflicts.eventId, resolved.eventId),
          eq(judgeTeamConflicts.judgeId, user.id),
          eq(judgeTeamConflicts.teamId, teamId)
        )
      )
      .limit(1);

    return NextResponse.json({
      hasConflict: declaration?.hasConflict ?? null,
      updatedAt: declaration?.updatedAt ?? null,
    });
  } catch (error) {
    return handleRouteError(error, 'Error fetching conflict declaration');
  }
}

// PUT: Create or update this judge's conflict declaration.
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await authServer.requireJudge();
    const { teamId } = await context.params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid JSON in request body');
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid request body');
    }

    const input = body as Record<string, unknown>;
    const { hasConflict } = input;

    if (typeof hasConflict !== 'boolean') {
      return sendApiError(
        400,
        'INVALID_CONFLICT_OF_INTEREST',
        'Conflict of interest must be Yes or No'
      );
    }

    if (input.eventId != null && typeof input.eventId !== 'string') {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid event ID');
    }

    const resolved = await resolveJudgeEvent(
      user.id,
      (input.eventId as string | undefined) || null
    );

    if (!resolved.ok) {
      return resolved.response;
    }

    // A judge may only declare conflicts for teams in their assigned event.
    const [team] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.eventId, resolved.eventId)))
      .limit(1);

    if (!team) {
      return sendApiError(404, 'TEAM_NOT_FOUND', 'Team not found in active event');
    }

    const [declaration] = await db
      .insert(judgeTeamConflicts)
      .values({
        eventId: resolved.eventId,
        judgeId: user.id,
        teamId,
        hasConflict,
      })
      .onConflictDoUpdate({
        target: [judgeTeamConflicts.eventId, judgeTeamConflicts.judgeId, judgeTeamConflicts.teamId],
        set: {
          hasConflict,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning({
        hasConflict: judgeTeamConflicts.hasConflict,
        updatedAt: judgeTeamConflicts.updatedAt,
      });

    return NextResponse.json({
      success: true,
      hasConflict: declaration.hasConflict,
      updatedAt: declaration.updatedAt,
    });
  } catch (error) {
    return handleRouteError(error, 'Error saving conflict declaration');
  }
}
