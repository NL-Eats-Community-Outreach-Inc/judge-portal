import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { events, eventParticipants, teamMembers, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;

    // Verify event exists and is open or active
    const [event] = await db
      .select({ id: events.id, status: events.status, name: events.name })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.status !== 'open' && event.status !== 'active') {
      return NextResponse.json(
        { error: 'Event is not available for registration' },
        { status: 400 }
      );
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
          and(
            eq(eventParticipants.eventId, eventId),
            eq(eventParticipants.participantId, user.id)
          )
        )
        .limit(1);

      return NextResponse.json({
        registration: existing,
        message: 'Already registered',
      });
    }

    return NextResponse.json({ registration });
  } catch (error) {
    console.error('Error registering for event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;

    // Verify event exists and is open (can only unregister during open)
    const [event] = await db
      .select({ id: events.id, status: events.status })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.status !== 'open') {
      return NextResponse.json(
        { error: 'Can only unregister from events in open status' },
        { status: 400 }
      );
    }

    // Check if participant is on a team for this event
    const teamMembership = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(and(eq(teams.eventId, eventId), eq(teamMembers.participantId, user.id)))
      .limit(1);

    if (teamMembership.length > 0) {
      return NextResponse.json(
        { error: 'Must leave your team before unregistering' },
        { status: 400 }
      );
    }

    // Delete registration
    const deleted = await db
      .delete(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.participantId, user.id)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Not registered for this event' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unregistering from event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
