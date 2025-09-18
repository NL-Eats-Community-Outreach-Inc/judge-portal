import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { criteria, events } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
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

    // Get criteria for the event
    const eventCriteria = await db
      .select()
      .from(criteria)
      .where(eq(criteria.eventId, eventId))
      .orderBy(criteria.displayOrder);

    await client.end();

    return NextResponse.json(eventCriteria);
  } catch (error) {
    console.error('Error fetching event criteria:', error);
    return NextResponse.json({ error: 'Failed to fetch criteria' }, { status: 500 });
  }
}
