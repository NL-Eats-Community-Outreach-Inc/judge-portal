import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { teams, events, eventJudges } from '@/lib/db/schema';
import { eq, asc, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireAuth();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    // Find all active events the judge is assigned to
    const assignedEvents = await db
      .select({ id: events.id })
      .from(eventJudges)
      .innerJoin(events, eq(eventJudges.eventId, events.id))
      .where(and(eq(eventJudges.judgeId, user.id), eq(events.status, 'active')));

    if (assignedEvents.length === 0) {
      return NextResponse.json({ teams: [] });
    }

    // Resolve which event to use
    let resolvedEventId: string;

    if (eventId) {
      const selected = assignedEvents.find((e) => e.id === eventId);
      if (!selected) {
        return NextResponse.json(
          { error: 'You are not assigned to this event', errorType: 'NOT_ASSIGNED' },
          { status: 403 }
        );
      }
      resolvedEventId = eventId;
    } else if (assignedEvents.length === 1) {
      resolvedEventId = assignedEvents[0].id;
    } else {
      // Multiple events, no selection
      return NextResponse.json(
        { error: 'Multiple events available', errorType: 'SELECT_EVENT' },
        { status: 300 }
      );
    }

    // Get all teams for the resolved event, ordered by presentation_order
    const eventTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        presentationOrder: teams.presentationOrder,
      })
      .from(teams)
      .where(eq(teams.eventId, resolvedEventId))
      .orderBy(asc(teams.presentationOrder));

    return NextResponse.json({ teams: eventTeams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
