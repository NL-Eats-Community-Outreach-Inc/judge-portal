import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { events, organizations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

export async function GET() {
  try {
    const user = await authServer.requireAdmin();

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
    return handleRouteError(error, 'Error fetching events');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();

    const orgId = await getAdminOrgId(user.id);
    const { name, description, status, maxTeamSize } = await request.json();

    if (!name || !name.trim()) {
      return sendApiError(400, 'BAD_REQUEST', 'Event name is required');
    }

    // Every event starts in setup; the status changes through PUT afterwards
    if (status !== undefined && status !== 'setup') {
      return sendApiError(400, 'INVALID_STATUS', 'New events are created in setup');
    }

    if (
      maxTeamSize !== undefined &&
      maxTeamSize !== null &&
      !(Number.isInteger(maxTeamSize) && maxTeamSize >= 1)
    ) {
      return sendApiError(400, 'BAD_REQUEST', 'Max team size must be a whole number of at least 1');
    }

    // Create new event
    const [event] = await db
      .insert(events)
      .values({
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        status: 'setup',
        organizationId: orgId,
        maxTeamSize: maxTeamSize ?? null,
      })
      .returning();

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Error creating event');
  }
}
