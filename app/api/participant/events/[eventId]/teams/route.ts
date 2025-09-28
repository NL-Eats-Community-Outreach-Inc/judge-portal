import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { teams, teamMembers, events, users } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    // Verify user is authenticated and is a participant
    const user = await getUserFromSession();
    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;

    // Connect to database
    const client = postgres(process.env.DATABASE_URL!, { prepare: false });
    const db = drizzle(client, { schema });

    // Verify event exists and is accessible (setup only)
    const event = await db
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.status, 'setup')))
      .limit(1);

    if (event.length === 0) {
      await client.end();
      return NextResponse.json({ error: 'Event not found or not accessible' }, { status: 404 });
    }

    // Get all teams for the event
    const eventTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        demoUrl: teams.demoUrl,
        repoUrl: teams.repoUrl,
        awardType: teams.awardType,
        presentationOrder: teams.presentationOrder,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
        eventId: teams.eventId,
      })
      .from(teams)
      .where(eq(teams.eventId, eventId))
      .orderBy(teams.presentationOrder);

    // Get member counts for all teams (but not member details for privacy)
    const teamsWithCounts = await Promise.all(
      eventTeams.map(async (team) => {
        const memberCount = await db
          .select({ count: count(teamMembers.id) })
          .from(teamMembers)
          .where(eq(teamMembers.teamId, team.id));

        return {
          ...team,
          members: [], // Empty for privacy - only populated for user's own team later
          memberCount: memberCount[0]?.count || 0,
        };
      })
    );

    // Check if user is on any team in this event and get user's team details
    const userTeamMember = await db
      .select({
        teamId: teamMembers.teamId,
      })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, user.id), eq(teamMembers.eventId, eventId)))
      .limit(1);

    const userTeamId = userTeamMember[0]?.teamId;

    // Get user's team details with member information if they have one
    let userTeam = null;
    if (userTeamId) {
      const userTeamBase = teamsWithCounts.find((team) => team.id === userTeamId);
      if (userTeamBase) {
        // Fetch member details only for user's own team
        const members = await db
          .select({
            id: teamMembers.id,
            userId: teamMembers.userId,
            userEmail: users.email,
            joinedAt: teamMembers.joinedAt,
          })
          .from(teamMembers)
          .leftJoin(users, eq(teamMembers.userId, users.id))
          .where(eq(teamMembers.teamId, userTeamId));

        userTeam = {
          ...userTeamBase,
          members,
          userIsMember: true,
        };
      }
    }

    // Add userIsMember flag to all teams
    const teamsWithMemberInfo = teamsWithCounts.map((team) => ({
      ...team,
      userIsMember: team.id === userTeamId,
    }));

    await client.end();

    return NextResponse.json({
      teams: teamsWithMemberInfo,
      userTeam,
    });
  } catch (error) {
    console.error('Error fetching event teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
