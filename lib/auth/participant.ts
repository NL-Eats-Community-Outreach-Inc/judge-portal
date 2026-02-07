import { db } from '@/lib/db';
import { teams, teamMembers, events, eventParticipants } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Verify participant is a member of the team. Returns membership row.
 * Throws 'NOT_MEMBER' if not a member.
 */
export async function requireTeamMembership(teamId: string, participantId: string) {
  const [membership] = await db
    .select({
      id: teamMembers.id,
      isCreator: teamMembers.isCreator,
      teamId: teamMembers.teamId,
      participantId: teamMembers.participantId,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.participantId, participantId)))
    .limit(1);

  if (!membership) {
    throw new Error('NOT_MEMBER');
  }
  return membership;
}

/**
 * Verify participant is the creator of the team. Returns membership row.
 * Throws 'NOT_CREATOR' if not the creator, 'NOT_MEMBER' if not a member.
 */
export async function requireTeamCreator(teamId: string, participantId: string) {
  const membership = await requireTeamMembership(teamId, participantId);
  if (!membership.isCreator) {
    throw new Error('NOT_CREATOR');
  }
  return membership;
}

/**
 * Verify the team exists and its event is in 'open' status.
 * Returns team + event info. Throws 'TEAM_NOT_FOUND' or 'EVENT_NOT_OPEN'.
 */
export async function requireTeamEventOpen(teamId: string) {
  const [result] = await db
    .select({
      teamId: teams.id,
      eventId: events.id,
      eventStatus: events.status,
      eventName: events.name,
      maxTeamSize: events.maxTeamSize,
    })
    .from(teams)
    .innerJoin(events, eq(teams.eventId, events.id))
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!result) {
    throw new Error('TEAM_NOT_FOUND');
  }
  if (result.eventStatus !== 'open') {
    throw new Error('EVENT_NOT_OPEN');
  }
  return result;
}

/**
 * Get team + event info (any status). Throws 'TEAM_NOT_FOUND'.
 */
export async function getTeamWithEvent(teamId: string) {
  const [result] = await db
    .select({
      teamId: teams.id,
      eventId: events.id,
      eventStatus: events.status,
      eventName: events.name,
      maxTeamSize: events.maxTeamSize,
    })
    .from(teams)
    .innerJoin(events, eq(teams.eventId, events.id))
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!result) {
    throw new Error('TEAM_NOT_FOUND');
  }
  return result;
}

/**
 * Verify participant is registered for an event. Throws 'NOT_REGISTERED'.
 */
export async function requireEventRegistration(eventId: string, participantId: string) {
  const [registration] = await db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .where(
      and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.participantId, participantId))
    )
    .limit(1);

  if (!registration) {
    throw new Error('NOT_REGISTERED');
  }
  return registration;
}
