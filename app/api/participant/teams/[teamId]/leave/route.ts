import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { teams, teamMembers, events } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

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

    // Verify team exists
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

    // Check if registration is still open for the event
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
        { error: 'Registration is closed, cannot leave team' },
        { status: 403 }
      );
    }

    // Check team member count to decide if team should be deleted
    const teamMemberCount = await db
      .select({ count: count(teamMembers.id) })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));

    const currentMemberCount = teamMemberCount[0]?.count || 0;

    // Remove user from team
    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));

    // If this was the last member, delete the team
    if (currentMemberCount <= 1) {
      await db.delete(teams).where(eq(teams.id, teamId));
    }

    await client.end();

    return NextResponse.json({
      message:
        currentMemberCount <= 1
          ? 'Left team and team was deleted (no remaining members)'
          : 'Successfully left the team',
    });
  } catch (error) {
    console.error('Error leaving team:', error);
    return NextResponse.json({ error: 'Failed to leave team' }, { status: 500 });
  }
}
