import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const { name, description, status, registrationOpen, registrationCloseAt, maxTeamSize } =
      await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Event name is required' }, { status: 400 });
    }

    const teamSize = maxTeamSize || 5;

    // Validate team size
    if (teamSize < 1 || teamSize > 20) {
      return NextResponse.json({ error: 'Team size must be between 1 and 20' }, { status: 400 });
    }

    // Validate registration close date if provided
    // Note: Commented out to allow admins to set any date (including past dates for events where registration has closed)
    // if (registrationCloseAt && new Date(registrationCloseAt) <= new Date()) {
    //   return NextResponse.json(
    //     { error: 'Registration close date must be in the future' },
    //     { status: 400 }
    //   );
    // }

    // If setting event to active, ensure no other event is active
    if (status === 'active') {
      const activeEvents = await db.select().from(events).where(eq(events.status, 'active'));

      // Check if there's an active event that's not the current one being updated
      const otherActiveEvent = activeEvents.find((event) => event.id !== eventId);
      if (otherActiveEvent) {
        return NextResponse.json(
          {
            error: 'Another event is already active. Please deactivate it first.',
          },
          { status: 400 }
        );
      }
    }

    // Update the event
    const [updatedEvent] = await db
      .update(events)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        status: status || 'setup',
        registrationOpen: Boolean(registrationOpen),
        registrationCloseAt: registrationCloseAt || null,
        maxTeamSize: teamSize,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(events.id, eventId))
      .returning();

    if (!updatedEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ event: updatedEvent });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;

    // Check if event exists before deletion
    const existingEvent = await db.select().from(events).where(eq(events.id, eventId)).limit(1);

    if (!existingEvent.length) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Delete the event (cascading deletes will handle related data)
    await db.delete(events).where(eq(events.id, eventId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
