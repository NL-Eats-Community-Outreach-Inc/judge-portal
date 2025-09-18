import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all events, ordered by created date (newest first)
    const allEvents = await db.select().from(events).orderBy(desc(events.createdAt));

    return NextResponse.json({ events: allEvents });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description, status, registrationOpen, registrationCloseAt, maxTeamSize } =
      await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Event name is required' }, { status: 400 });
    }

    const eventStatus = status || 'setup';
    const teamSize = maxTeamSize || 5;

    // Validate team size
    if (teamSize < 1 || teamSize > 20) {
      return NextResponse.json({ error: 'Team size must be between 1 and 20' }, { status: 400 });
    }

    // Validate registration close date if provided
    if (registrationCloseAt && new Date(registrationCloseAt) <= new Date()) {
      return NextResponse.json(
        { error: 'Registration close date must be in the future' },
        { status: 400 }
      );
    }

    // If setting event to active, ensure no other event is active
    if (eventStatus === 'active') {
      const activeEvents = await db.select().from(events).where(eq(events.status, 'active'));
      if (activeEvents.length > 0) {
        return NextResponse.json(
          {
            error: 'Another event is already active. Please deactivate it first.',
          },
          { status: 400 }
        );
      }
    }

    // Create new event
    const [event] = await db
      .insert(events)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        status: eventStatus,
        registrationOpen: Boolean(registrationOpen),
        registrationCloseAt: registrationCloseAt || null,
        maxTeamSize: teamSize,
      })
      .returning();

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
