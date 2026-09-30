import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

const EVENT_STATUSES = ['setup', 'open', 'active', 'completed'] as const;
type EventStatus = (typeof EVENT_STATUSES)[number];

function isEventStatus(value: unknown): value is EventStatus {
  return typeof value === 'string' && (EVENT_STATUSES as readonly string[]).includes(value);
}

/** `max_team_size` is unlimited (`null`) or a whole number of at least 1. */
function isTeamSize(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && (value as number) >= 1);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const { eventId } = await params;
    await requireEventInOrg(eventId, orgId);

    const body = await request.json();
    const { name, description, status, maxTeamSize } = body;

    if (!name || !name.trim()) {
      return sendApiError(400, 'BAD_REQUEST', 'Event name is required');
    }

    // Status only changes when the body names one of the four enum values;
    // omitting it leaves the stored status untouched.
    if (status !== undefined && !isEventStatus(status)) {
      return sendApiError(400, 'INVALID_STATUS', 'Invalid event status');
    }

    if (maxTeamSize !== undefined && !isTeamSize(maxTeamSize)) {
      return sendApiError(400, 'BAD_REQUEST', 'Max team size must be a whole number of at least 1');
    }

    if (description !== undefined && description !== null && typeof description !== 'string') {
      return sendApiError(400, 'BAD_REQUEST', 'Description must be text');
    }

    const [existingEvent] = await db
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!existingEvent) {
      return sendApiError(404, 'NOT_FOUND', 'Event not found');
    }

    if (status === 'setup' && existingEvent.status === 'completed') {
      return sendApiError(400, 'INVALID_STATUS', 'A completed event cannot go back to setup');
    }

    // Only the fields the body carries change: a scripted `{ name, status }`
    // must not wipe the description or the team size
    const [updatedEvent] = await db
      .update(events)
      .set({
        name: name.trim(),
        ...('description' in body ? { description: description?.trim() || null } : {}),
        ...(status !== undefined ? { status } : {}),
        ...('maxTeamSize' in body ? { maxTeamSize } : {}),
      })
      .where(eq(events.id, eventId))
      .returning();

    if (!updatedEvent) {
      return sendApiError(404, 'NOT_FOUND', 'Event not found');
    }

    return NextResponse.json({ event: updatedEvent });
  } catch (error) {
    return handleRouteError(error, 'Error updating event');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const { eventId } = await params;
    await requireEventInOrg(eventId, orgId);

    const [existingEvent] = await db
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!existingEvent) {
      return sendApiError(404, 'NOT_FOUND', 'Event not found');
    }

    // The UI disables the delete control for non-setup events; this guard is
    // what protects a live event from a stale tab.
    if (existingEvent.status !== 'setup') {
      return sendApiError(400, 'INVALID_STATUS', 'Only events in setup can be deleted');
    }

    // Cascading deletes remove the event's teams, criteria, scores and assignments
    await db.delete(events).where(eq(events.id, eventId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Error deleting event');
  }
}
