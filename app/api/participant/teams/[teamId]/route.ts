import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { teams, teamMembers, events } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    // Verify user is authenticated and is a participant
    const user = await getUserFromSession();
    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await params;
    const body = await request.json();
    const { name, description, demoUrl, repoUrl, awardType } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    // Connect to database
    const client = postgres(process.env.DATABASE_URL!, { prepare: false });
    const db = drizzle(client, { schema });

    // Verify team exists and user is a member
    const team = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);

    if (team.length === 0) {
      await client.end();
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const teamData = team[0];

    // Check if user is a member of this team
    const membership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))
      .limit(1);

    if (membership.length === 0) {
      await client.end();
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }

    // Check if registration is still open
    const event = await db.select().from(events).where(eq(events.id, teamData.eventId)).limit(1);

    if (event.length === 0) {
      await client.end();
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventData = event[0];
    const isRegistrationOpen =
      eventData.registrationOpen &&
      (!eventData.registrationCloseAt || new Date(eventData.registrationCloseAt) > new Date());

    if (!isRegistrationOpen) {
      await client.end();
      return NextResponse.json(
        { error: 'Registration is closed, cannot update team' },
        { status: 403 }
      );
    }

    // Check if new name conflicts with existing teams (if name is being changed)
    if (name !== teamData.name) {
      const existingTeam = await db
        .select()
        .from(teams)
        .where(and(eq(teams.eventId, teamData.eventId), eq(teams.name, name)))
        .limit(1);

      if (existingTeam.length > 0) {
        await client.end();
        return NextResponse.json(
          { error: 'A team with this name already exists for this event' },
          { status: 409 }
        );
      }
    }

    // Update the team
    const updatedTeam = await db
      .update(teams)
      .set({
        name,
        description: description || null,
        demoUrl: demoUrl || null,
        repoUrl: repoUrl || null,
        awardType: awardType || 'both',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    await client.end();

    return NextResponse.json(updatedTeam[0]);
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    // Verify user is authenticated and is a participant
    const user = await getUserFromSession();
    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await params;

    // Connect to database
    const client = postgres(process.env.DATABASE_URL!, { prepare: false });
    const db = drizzle(client, { schema });

    // Verify team exists and get member count
    const teamWithCount = await db
      .select({
        team: teams,
        memberCount: count(teamMembers.id),
      })
      .from(teams)
      .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teams.id, teamId))
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

    if (teamWithCount.length === 0) {
      await client.end();
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { team: teamData, memberCount } = teamWithCount[0];

    // Check if user is a member of this team
    const membership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))
      .limit(1);

    if (membership.length === 0) {
      await client.end();
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }

    // Only allow deletion if user is the sole member
    if (memberCount > 1) {
      await client.end();
      return NextResponse.json(
        { error: 'Cannot delete team with multiple members. Leave the team instead.' },
        { status: 403 }
      );
    }

    // Check if registration is still open
    const event = await db.select().from(events).where(eq(events.id, teamData.eventId)).limit(1);

    if (event.length === 0) {
      await client.end();
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventData = event[0];
    const isRegistrationOpen =
      eventData.registrationOpen &&
      (!eventData.registrationCloseAt || new Date(eventData.registrationCloseAt) > new Date());

    if (!isRegistrationOpen) {
      await client.end();
      return NextResponse.json(
        { error: 'Registration is closed, cannot delete team' },
        { status: 403 }
      );
    }

    // Delete the team (team members will be deleted by cascade)
    await db.delete(teams).where(eq(teams.id, teamId));

    await client.end();

    return NextResponse.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}
