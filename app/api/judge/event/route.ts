import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { events, eventJudges, organizations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireAuth();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    // Find all active events the judge is assigned to
    const assignedEvents = await db
      .select({
        id: events.id,
        name: events.name,
        description: events.description,
        status: events.status,
        organizationName: organizations.name,
      })
      .from(eventJudges)
      .innerJoin(events, eq(eventJudges.eventId, events.id))
      .leftJoin(organizations, eq(events.organizationId, organizations.id))
      .where(and(eq(eventJudges.judgeId, user.id), eq(events.status, 'active')));

    if (assignedEvents.length === 0) {
      return NextResponse.json({ event: null });
    }

    // If eventId provided, verify judge is assigned to it
    if (eventId) {
      const selected = assignedEvents.find((e) => e.id === eventId);
      if (!selected) {
        return NextResponse.json(
          { error: 'You are not assigned to this event', errorType: 'NOT_ASSIGNED' },
          { status: 403 }
        );
      }
      return NextResponse.json({ event: selected });
    }

    // Auto-select if only 1 event
    if (assignedEvents.length === 1) {
      return NextResponse.json({ event: assignedEvents[0] });
    }

    // Multiple events, no selection — tell client to pick
    return NextResponse.json(
      {
        error: 'Multiple events available',
        errorType: 'SELECT_EVENT',
        events: assignedEvents,
      },
      { status: 300 }
    );
  } catch (error) {
    console.error('Error fetching active event:', error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}
