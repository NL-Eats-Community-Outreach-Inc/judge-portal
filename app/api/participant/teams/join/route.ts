import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { teams, teamMembers, events, eventParticipants } from '@/lib/db/schema';
import { eq, and, sql, count } from 'drizzle-orm';
import { isValidJoinCode } from '@/lib/utils/join-code';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { joinCode } = await request.json();

    if (!joinCode || typeof joinCode !== 'string') {
      return NextResponse.json({ error: 'Join code is required' }, { status: 400 });
    }

    const normalizedCode = joinCode.toUpperCase().trim();

    if (!isValidJoinCode(normalizedCode)) {
      return NextResponse.json({ error: 'Invalid join code format' }, { status: 400 });
    }

    // Find team by join code
    const [team] = await db
      .select({
        id: teams.id,
        name: teams.name,
        eventId: teams.eventId,
        joinCode: teams.joinCode,
      })
      .from(teams)
      .where(eq(teams.joinCode, normalizedCode))
      .limit(1);

    if (!team) {
      return NextResponse.json({ error: 'Invalid join code' }, { status: 404 });
    }

    // Verify event is open
    const [event] = await db
      .select({ id: events.id, status: events.status, maxTeamSize: events.maxTeamSize })
      .from(events)
      .where(eq(events.id, team.eventId))
      .limit(1);

    if (!event || event.status !== 'open') {
      return NextResponse.json(
        { error: 'Teams can only be joined when the event is in open status' },
        { status: 400 }
      );
    }

    // Verify participant is registered for this event
    const [registration] = await db
      .select({ id: eventParticipants.id })
      .from(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, team.eventId),
          eq(eventParticipants.participantId, user.id)
        )
      )
      .limit(1);

    if (!registration) {
      return NextResponse.json(
        { error: 'You must register for this event first' },
        { status: 400 }
      );
    }

    // Use transaction with advisory lock
    const result = await db.transaction(async (tx) => {
      // Advisory lock on (eventId, participantId) to prevent concurrent joins
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${team.eventId} || ${user.id}))`);

      // Check participant is not already on a team for this event
      const existing = await tx
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(and(eq(teams.eventId, team.eventId), eq(teamMembers.participantId, user.id)))
        .limit(1);

      if (existing.length > 0) {
        throw new Error('ALREADY_ON_TEAM');
      }

      // Lock team row and check team size
      if (event.maxTeamSize) {
        // Lock the team row to prevent concurrent joins
        await tx.execute(sql`SELECT id FROM teams WHERE id = ${team.id} FOR UPDATE`);

        // Count current members
        const [countResult] = await tx
          .select({ memberCount: count(teamMembers.id) })
          .from(teamMembers)
          .where(eq(teamMembers.teamId, team.id));

        if (Number(countResult.memberCount) >= event.maxTeamSize) {
          throw new Error('TEAM_FULL');
        }
      }

      // Add participant as team member
      const [membership] = await tx
        .insert(teamMembers)
        .values({
          teamId: team.id,
          participantId: user.id,
          isCreator: false,
        })
        .returning();

      return { membership };
    });

    return NextResponse.json({ team, membership: result.membership });
  } catch (error) {
    console.error('Error joining team:', error);

    if (error instanceof Error) {
      if (error.message === 'ALREADY_ON_TEAM') {
        return NextResponse.json(
          { error: 'You are already on a team for this event' },
          { status: 400 }
        );
      }
      if (error.message === 'TEAM_FULL') {
        return NextResponse.json({ error: 'This team is full' }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
