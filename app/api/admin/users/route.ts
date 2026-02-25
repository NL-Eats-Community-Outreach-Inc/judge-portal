import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import {
  users,
  organizationMembers,
  teamMembers,
  teams,
  events,
  eventParticipants,
} from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';

export async function GET() {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);

    // 1. Admins from same org
    const orgAdmins = await db
      .select()
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.role, 'admin')))
      .orderBy(users.createdAt);

    // 2. Judges who are members of this org (via organization_members)
    const orgJudgeRows = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));
    const orgJudgeIds = orgJudgeRows.map((r) => r.userId);

    const orgJudges =
      orgJudgeIds.length > 0
        ? await db
            .select()
            .from(users)
            .where(and(eq(users.role, 'judge'), inArray(users.id, orgJudgeIds)))
            .orderBy(users.createdAt)
        : [];

    // 3a. Participants on teams in this org's events (teamMembers → teams → events)
    const teamParticipantRows = await db
      .selectDistinct({ participantId: teamMembers.participantId })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .innerJoin(events, eq(events.id, teams.eventId))
      .where(eq(events.organizationId, orgId));

    // 3b. Participants registered for this org's events (eventParticipants → events)
    const registeredParticipantRows = await db
      .selectDistinct({ participantId: eventParticipants.participantId })
      .from(eventParticipants)
      .innerJoin(events, eq(events.id, eventParticipants.eventId))
      .where(eq(events.organizationId, orgId));

    // Merge and deduplicate
    const orgParticipantIds = [
      ...new Set([
        ...teamParticipantRows.map((r) => r.participantId),
        ...registeredParticipantRows.map((r) => r.participantId),
      ]),
    ];

    const orgParticipants =
      orgParticipantIds.length > 0
        ? await db
            .select()
            .from(users)
            .where(and(eq(users.role, 'participant'), inArray(users.id, orgParticipantIds)))
            .orderBy(users.createdAt)
        : [];

    const allUsers = [...orgAdmins, ...orgJudges, ...orgParticipants];

    return NextResponse.json({ users: allUsers });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
