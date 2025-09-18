import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { teams, teamMembers, events, users } from '@/lib/db/schema';
import { eq, and, or, count } from 'drizzle-orm';
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

    // Verify event exists and is accessible (setup or active)
    const event = await db
      .select()
      .from(events)
      .where(
        and(eq(events.id, eventId), or(eq(events.status, 'setup'), eq(events.status, 'active')))
      )
      .limit(1);

    if (event.length === 0) {
      await client.end();
      return NextResponse.json({ error: 'Event not found or not accessible' }, { status: 404 });
    }

    // Get all teams for the event with member counts
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
        memberCount: count(teamMembers.id),
      })
      .from(teams)
      .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teams.eventId, eventId))
      .groupBy(
        teams.id,
        teams.name,
        teams.description,
        teams.demoUrl,
        teams.repoUrl,
        teams.awardType,
        teams.presentationOrder,
        teams.createdAt,
        teams.updatedAt,
        teams.eventId
      )
      .orderBy(teams.presentationOrder);

    // Check if user is on any team in this event
    const userTeamMember = await db
      .select({
        teamId: teamMembers.teamId,
      })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, user.id), eq(teamMembers.eventId, eventId)))
      .limit(1);

    const userTeamId = userTeamMember[0]?.teamId;

    // Get user's team details if they have one
    let userTeam = null;
    if (userTeamId) {
      const userTeamData = await db
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
          memberCount: count(teamMembers.id),
        })
        .from(teams)
        .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
        .where(eq(teams.id, userTeamId))
        .groupBy(
          teams.id,
          teams.name,
          teams.description,
          teams.demoUrl,
          teams.repoUrl,
          teams.awardType,
          teams.presentationOrder,
          teams.createdAt,
          teams.updatedAt,
          teams.eventId
        )
        .limit(1);

      if (userTeamData.length > 0) {
        userTeam = {
          ...userTeamData[0],
          members: [],
          userIsMember: true,
        };
      }
    }

    // Add userIsMember flag to all teams
    const teamsWithMemberInfo = eventTeams.map((team) => ({
      ...team,
      members: [],
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
