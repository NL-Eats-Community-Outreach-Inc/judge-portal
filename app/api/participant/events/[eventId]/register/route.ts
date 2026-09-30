import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { events, eventParticipants, teamMembers, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await authServer.requireParticipant();

    const { eventId } = await params;

    // Verify event exists and is open or active
    const [event] = await db
      .select({ id: events.id, status: events.status, name: events.name })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return sendApiError(404, 'NOT_FOUND', 'Event not found');
    }

    if (event.status !== 'open' && event.status !== 'active') {
      return sendApiError(400, 'BAD_REQUEST', 'Event is not available for registration');
    }

    // Idempotent insert
    const [registration] = await db
      .insert(eventParticipants)
      .values({
        eventId,
        participantId: user.id,
      })
      .onConflictDoNothing({
        target: [eventParticipants.eventId, eventParticipants.participantId],
      })
      .returning();

    if (!registration) {
      // Already registered — return existing registration
      const [existing] = await db
        .select()
        .from(eventParticipants)
        .where(
          and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.participantId, user.id))
        )
        .limit(1);

      return NextResponse.json({
        registration: existing,
        message: 'Already registered',
      });
    }

    return NextResponse.json({ registration }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Error registering for event');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await authServer.requireParticipant();

    const { eventId } = await params;

    // Verify event exists and is open (can only unregister during open)
    const [event] = await db
      .select({ id: events.id, status: events.status })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return sendApiError(404, 'NOT_FOUND', 'Event not found');
    }

    if (event.status !== 'open') {
      return sendApiError(400, 'BAD_REQUEST', 'Can only unregister from events in open status');
    }

    // Check if participant is on a team for this event
    const teamMembership = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(and(eq(teams.eventId, eventId), eq(teamMembers.participantId, user.id)))
      .limit(1);

    if (teamMembership.length > 0) {
      return sendApiError(400, 'BAD_REQUEST', 'Must leave your team before unregistering');
    }

    // Delete registration
    const deleted = await db
      .delete(eventParticipants)
      .where(
        and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.participantId, user.id))
      )
      .returning();

    if (deleted.length === 0) {
      return sendApiError(404, 'NOT_FOUND', 'Not registered for this event');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Error unregistering from event');
  }
}
