import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { events, organizations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';
import { sendApiError } from '@/lib/utils/api-errors';

export async function GET() {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const orgId = await getAdminOrgId(user.id);

    // Get org's events, ordered by created date (newest first)
    const allEvents = await db
      .select()
      .from(events)
      .where(eq(events.organizationId, orgId))
      .orderBy(desc(events.createdAt));

    // Get organization name
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    return NextResponse.json({ events: allEvents, organizationName: org?.name ?? null });
  } catch (error) {
    console.error('Error fetching events:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const orgId = await getAdminOrgId(user.id);
    const { name, description, status, maxTeamSize } = await request.json();

    if (!name || !name.trim()) {
      return sendApiError(400, 'BAD_REQUEST', 'Event name is required');
    }

    const eventStatus = status || 'setup';

    // Create new event
    const [event] = await db
      .insert(events)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        status: eventStatus,
        organizationId: orgId,
        maxTeamSize: maxTeamSize ?? null,
      })
      .returning();

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Error creating event:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}