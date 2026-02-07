import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';

export async function GET() {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);

    // Get org's events, ordered by created date (newest first)
    const allEvents = await db
      .select()
      .from(events)
      .where(eq(events.organizationId, orgId))
      .orderBy(desc(events.createdAt));

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

    const orgId = await getAdminOrgId(user.id);
    const { name, description, status } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Event name is required' }, { status: 400 });
    }

    const eventStatus = status || 'setup';

    // If setting event to active, ensure no other event in this org is active
    if (eventStatus === 'active') {
      const activeEvents = await db
        .select()
        .from(events)
        .where(and(eq(events.status, 'active'), eq(events.organizationId, orgId)));
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
        organizationId: orgId,
      })
      .returning();

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
