import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { teams, teamMembers, events } from '@/lib/db/schema';
import { eq, and, max } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and is a participant
    const user = await getUserFromSession();
    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, demoUrl, repoUrl, awardType, eventId } = body;

    // Validate required fields
    if (!name || !eventId) {
      return NextResponse.json({ error: 'Team name and event ID are required' }, { status: 400 });
    }

    // Connect to database
    const client = postgres(process.env.DATABASE_URL!, { prepare: false });
    const db = drizzle(client, { schema });

    // Verify event exists and is in setup status
    const event = await db
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.status, 'setup')))
      .limit(1);

    if (event.length === 0) {
      await client.end();
      return NextResponse.json({ error: 'Event not found or not accessible' }, { status: 404 });
    }

    const eventData = event[0];

    // Check if registration is open
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
      .where(and(eq(teamMembers.userId, user.id), eq(teamMembers.eventId, eventId)))
      .limit(1);

    if (existingMembership.length > 0) {
      await client.end();
      return NextResponse.json(
        { error: 'You are already on a team for this event' },
        { status: 409 }
      );
    }

    // Check if team name already exists for this event
    const existingTeam = await db
      .select()
      .from(teams)
      .where(and(eq(teams.eventId, eventId), eq(teams.name, name)))
      .limit(1);

    if (existingTeam.length > 0) {
      await client.end();
      return NextResponse.json(
        { error: 'A team with this name already exists for this event' },
        { status: 409 }
      );
    }

    // Get the next presentation order
    const maxOrderResult = await db
      .select({ maxOrder: max(teams.presentationOrder) })
      .from(teams)
      .where(eq(teams.eventId, eventId));

    const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

    // Create the team
    const newTeam = await db
      .insert(teams)
      .values({
        name,
        description: description || null,
        demoUrl: demoUrl || null,
        repoUrl: repoUrl || null,
        awardType: awardType || 'both',
        eventId,
        presentationOrder: nextOrder,
      })
      .returning();

    // Add the creator as a team member
    await db.insert(teamMembers).values({
      teamId: newTeam[0].id,
      userId: user.id,
      eventId,
    });

    await client.end();

    return NextResponse.json(newTeam[0], { status: 201 });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}
