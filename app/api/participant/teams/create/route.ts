import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { teams, teamMembers, events, eventParticipants } from '@/lib/db/schema';
import { eq, and, max, sql } from 'drizzle-orm';
import { generateJoinCode } from '@/lib/utils/join-code';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { isUniqueOn } from '@/lib/db/errors';

export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireParticipant();

    const { eventId, name, description } = await request.json();

    if (!eventId) {
      return sendApiError(400, 'BAD_REQUEST', 'Event ID is required');
    }

    if (!name || !name.trim()) {
      return sendApiError(400, 'BAD_REQUEST', 'Team name is required');
    }

    // Verify event exists and is open
    const [event] = await db
      .select({ id: events.id, status: events.status, maxTeamSize: events.maxTeamSize })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return sendApiError(404, 'NOT_FOUND', 'Event not found');
    }

    if (event.status !== 'open') {
      return sendApiError(
        400,
        'EVENT_NOT_OPEN',
        'Teams can only be created when the event is in open status'
      );
    }

    // Verify participant is registered for this event
    const [registration] = await db
      .select({ id: eventParticipants.id })
      .from(eventParticipants)
      .where(
        and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.participantId, user.id))
      )
      .limit(1);

    if (!registration) {
      return sendApiError(400, 'NOT_REGISTERED', 'You must register for this event first');
    }

    const result = await db.transaction(async (tx) => {
      // Lock per event so two participants creating teams at the same time
      // are serialised and never compute the same presentation order.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`);

      // Check participant is not already on a team for this event
      const existing = await tx
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(and(eq(teams.eventId, eventId), eq(teamMembers.participantId, user.id)))
        .limit(1);

      if (existing.length > 0) {
        throw new Error('ALREADY_ON_TEAM');
      }

      const maxOrderResult = await tx
        .select({ maxOrder: max(teams.presentationOrder) })
        .from(teams)
        .where(eq(teams.eventId, eventId))
        .limit(1);

      const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

      const joinCode = await generateJoinCode();

      const [team] = await tx
        .insert(teams)
        .values({
          eventId,
          name: name.trim(),
          description: description?.trim() || null,
          awardType: 'both',
          presentationOrder: nextOrder,
          joinCode,
        })
        .returning();

      const [membership] = await tx
        .insert(teamMembers)
        .values({
          teamId: team.id,
          participantId: user.id,
          isCreator: true,
        })
        .returning();

      return { team, membership };
    });

    return NextResponse.json({ team: result.team, membership: result.membership }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_ON_TEAM') {
      return sendApiError(400, 'ALREADY_ON_TEAM', 'You are already on a team for this event');
    }
    if (isUniqueOn(error, 'event_id', 'name')) {
      return sendApiError(
        400,
        'DUPLICATE_TEAM_NAME',
        'A team with this name already exists in this event'
      );
    }
    // two creates drew the same presentation order or the same join code: retry
    if (isUniqueOn(error, 'event_id', 'presentation_order') || isUniqueOn(error, 'join_code')) {
      return sendApiError(409, 'CONFLICT', 'Please try again');
    }
    return handleRouteError(error, 'Error creating team');
  }
}
