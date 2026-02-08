import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { teams, teamMembers, events, eventParticipants } from '@/lib/db/schema';
import { eq, and, max, sql } from 'drizzle-orm';
import { generateJoinCode } from '@/lib/utils/join-code';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId, name, description } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    // Verify event exists and is open
    const [event] = await db
      .select({ id: events.id, status: events.status, maxTeamSize: events.maxTeamSize })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.status !== 'open') {
      return NextResponse.json(
        { error: 'Teams can only be created when the event is in open status' },
        { status: 400 }
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
      return NextResponse.json(
        { error: 'You must register for this event first' },
        { status: 400 }
      );
    }

    // Use transaction with advisory lock for race condition prevention
    const result = await db.transaction(async (tx) => {
      // Advisory lock on (eventId, participantId) to prevent concurrent team creation
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${eventId} || ${user.id}))`);

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

      // Calculate next presentation order
      const maxOrderResult = await tx
        .select({ maxOrder: max(teams.presentationOrder) })
        .from(teams)
        .where(eq(teams.eventId, eventId))
        .limit(1);

      const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

      // Generate join code
      const joinCode = await generateJoinCode();

      // Create team
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

      // Add creator as team member
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

    return NextResponse.json({ team: result.team, membership: result.membership });
  } catch (error) {
    console.error('Error creating team:', error);

    if (error instanceof Error) {
      if (error.message === 'ALREADY_ON_TEAM') {
        return NextResponse.json(
          { error: 'You are already on a team for this event' },
          { status: 400 }
        );
      }
      if (error.message.includes('duplicate key')) {
        if (error.message.includes('teams_event_id_name_key')) {
          return NextResponse.json(
            { error: 'A team with this name already exists in this event' },
            { status: 400 }
          );
        }
        if (error.message.includes('teams_event_id_presentation_order_key')) {
          // Presentation order collision — rare but possible
          return NextResponse.json({ error: 'Please try again' }, { status: 409 });
        }
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
