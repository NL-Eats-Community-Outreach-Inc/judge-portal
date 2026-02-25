import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { events, eventJudges, organizations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET() {
  try {
    const user = await authServer.requireAuth();

    // Get all active events the judge is assigned to, with org name
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

    return NextResponse.json({ events: assignedEvents });
  } catch (error) {
    console.error('Error fetching judge events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
