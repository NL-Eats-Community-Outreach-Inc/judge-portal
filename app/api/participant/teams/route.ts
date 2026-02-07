import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { teams, teamMembers, events } from '@/lib/db/schema';
import { eq, and, inArray, count } from 'drizzle-orm';

export async function GET() {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all teams the participant is a member of (in open/active events)
    const myTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        demoUrl: teams.demoUrl,
        repoUrl: teams.repoUrl,
        eventId: teams.eventId,
        joinCode: teams.joinCode,
        presentationOrder: teams.presentationOrder,
        awardType: teams.awardType,
        eventName: events.name,
        eventStatus: events.status,
        maxTeamSize: events.maxTeamSize,
        isCreator: teamMembers.isCreator,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .innerJoin(events, eq(teams.eventId, events.id))
      .where(
        and(
          eq(teamMembers.participantId, user.id),
          inArray(events.status, ['open', 'active'])
        )
      )
      .orderBy(events.name, teams.name);

    // Get member counts for each team
    const teamIds = myTeams.map((t) => t.id);
    let memberCounts: Record<string, number> = {};

    if (teamIds.length > 0) {
      const counts = await db
        .select({
          teamId: teamMembers.teamId,
          memberCount: count(teamMembers.id),
        })
        .from(teamMembers)
        .where(inArray(teamMembers.teamId, teamIds))
        .groupBy(teamMembers.teamId);

      memberCounts = Object.fromEntries(counts.map((c) => [c.teamId, Number(c.memberCount)]));
    }

    const result = myTeams.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      demoUrl: t.demoUrl,
      repoUrl: t.repoUrl,
      eventId: t.eventId,
      eventName: t.eventName,
      eventStatus: t.eventStatus,
      joinCode: t.joinCode,
      presentationOrder: t.presentationOrder,
      awardType: t.awardType,
      isCreator: t.isCreator,
      memberCount: memberCounts[t.id] || 0,
      maxTeamSize: t.maxTeamSize,
    }));

    return NextResponse.json({ teams: result });
  } catch (error) {
    console.error('Error fetching participant teams:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
