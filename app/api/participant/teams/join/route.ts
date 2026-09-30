import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { teams, teamMembers, events, eventParticipants } from '@/lib/db/schema';
import { eq, and, sql, count } from 'drizzle-orm';
import { isValidJoinCode } from '@/lib/utils/join-code';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireParticipant();

    const { joinCode } = await request.json();

    if (!joinCode || typeof joinCode !== 'string') {
      return sendApiError(400, 'BAD_REQUEST', 'Join code is required');
    }

    const normalizedCode = joinCode.toUpperCase().trim();

    if (!isValidJoinCode(normalizedCode)) {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid join code format');
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
      return sendApiError(404, 'NOT_FOUND', 'Invalid join code');
    }

    // Verify event is open
    const [event] = await db
      .select({ id: events.id, status: events.status, maxTeamSize: events.maxTeamSize })
      .from(events)
      .where(eq(events.id, team.eventId))
      .limit(1);

    if (!event || event.status !== 'open') {
      return sendApiError(
        400,
        'EVENT_NOT_OPEN',
        'Teams can only be joined when the event is in open status'
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
      return sendApiError(400, 'NOT_REGISTERED', 'You must register for this event first');
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

    return NextResponse.json({ team, membership: result.membership }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'ALREADY_ON_TEAM') {
        return sendApiError(400, 'ALREADY_ON_TEAM', 'You are already on a team for this event');
      }
      if (error.message === 'TEAM_FULL') {
        return sendApiError(400, 'TEAM_FULL', 'This team is full');
      }
    }
    return handleRouteError(error, 'Error joining team');
  }
}
