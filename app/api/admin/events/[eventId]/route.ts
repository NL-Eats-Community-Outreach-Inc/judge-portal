import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError } from '@/lib/utils/api-errors';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const orgId = await getAdminOrgId(user.id);
    const { eventId } = await params;
    await requireEventInOrg(eventId, orgId);

    const { name, description, status, maxTeamSize } = await request.json();

    if (!name || !name.trim()) {
      return sendApiError(400, 'BAD_REQUEST', 'Event name is required');
    }

    // Update the event
    const [updatedEvent] = await db
      .update(events)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        status: status || 'setup',
        maxTeamSize: maxTeamSize ?? null,
      })
      .where(eq(events.id, eventId))
      .returning();

    if (!updatedEvent) {
      return sendApiError(404, 'NOT_FOUND', 'Event not found');
    }

    return NextResponse.json({ event: updatedEvent });
  } catch (error) {
    console.error('Error updating event:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const orgId = await getAdminOrgId(user.id);
    const { eventId } = await params;
    await requireEventInOrg(eventId, orgId);

    // Check if event exists before deletion
    const existingEvent = await db.select().from(events).where(eq(events.id, eventId)).limit(1);

    if (!existingEvent.length) {
      return sendApiError(404, 'NOT_FOUND', 'Event not found');
    }

    // Delete the event (cascading deletes will handle related data)
    await db.delete(events).where(eq(events.id, eventId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}
