import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { teams, teamMembers, events } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

export async function POST(
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
      return NextResponse.json({ error: 'Registration is closed for this event' }, { status: 403 });
    }

    // Check if user is already on a team for this event
    const existingMembership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, user.id), eq(teamMembers.eventId, teamData.eventId)))
      .limit(1);

    if (existingMembership.length > 0) {
      await client.end();
      return NextResponse.json(
        { error: 'You are already on a team for this event' },
        { status: 409 }
      );
    }

    // Check if team is at capacity
    const teamMemberCount = await db
      .select({ count: count(teamMembers.id) })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId))
      .limit(1);

    const currentMemberCount = teamMemberCount[0]?.count || 0;

    if (currentMemberCount >= eventData.maxTeamSize) {
      await client.end();
      return NextResponse.json({ error: 'Team is at maximum capacity' }, { status: 409 });
    }

    // Add user to the team
    await db.insert(teamMembers).values({
      teamId,
      userId: user.id,
      eventId: teamData.eventId,
    });

    await client.end();

    return NextResponse.json({ message: 'Successfully joined the team' });
  } catch (error) {
    console.error('Error joining team:', error);
    return NextResponse.json({ error: 'Failed to join team' }, { status: 500 });
  }
}
