import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { teams, events } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { isUniqueOn } from '@/lib/db/errors';

export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();

    const orgId = await getAdminOrgId(user.id);
    const { eventId, teamOrders } = await request.json();

    if (!eventId) {
      return sendApiError(400, 'BAD_REQUEST', 'Event ID is required');
    }

    await requireEventInOrg(eventId, orgId);

    if (!Array.isArray(teamOrders) || teamOrders.length === 0) {
      return sendApiError(400, 'BAD_REQUEST', 'Team orders array is required');
    }

    // Validate team orders structure
    for (const teamOrder of teamOrders) {
      if (!teamOrder.id || typeof teamOrder.presentationOrder !== 'number') {
        return sendApiError(
          400,
          'BAD_REQUEST',
          'Each team order must have id and presentationOrder'
        );
      }
    }

    const [event] = await db
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return sendApiError(404, 'NOT_FOUND', 'Event not found');
    }

    // The Teams tab disables dragging for completed events; this guard is what
    // protects the final order from a stale tab
    if (event.status === 'completed') {
      return sendApiError(400, 'INVALID_STATUS', 'The event is completed');
    }

    // Use a transaction to avoid unique constraint violations
    const updatedTeams = await db.transaction(async (tx) => {
      // First, park every affected team on a distinct negative order: real
      // orders are positive, so the temporaries cannot collide with them or each other
      const tempUpdatePromises = teamOrders.map(({ id }, index) =>
        tx
          .update(teams)
          .set({ presentationOrder: -(index + 1) })
          .where(and(eq(teams.id, id), eq(teams.eventId, eventId)))
      );

      await Promise.all(tempUpdatePromises);

      // Then update to final values
      const finalUpdatePromises = teamOrders.map(({ id, presentationOrder }) =>
        tx
          .update(teams)
          .set({ presentationOrder })
          .where(and(eq(teams.id, id), eq(teams.eventId, eventId)))
          .returning()
      );

      const results = await Promise.all(finalUpdatePromises);
      return results.flat();
    });

    // Check if all updates were successful
    if (updatedTeams.length !== teamOrders.length) {
      return sendApiError(400, 'BAD_REQUEST', 'Some teams could not be updated');
    }

    return NextResponse.json({
      message: 'Team orders updated successfully',
      updatedTeams,
    });
  } catch (error) {
    if (isUniqueOn(error, 'event_id', 'presentation_order')) {
      return sendApiError(409, 'CONFLICT', 'Duplicate presentation order detected');
    }
    return handleRouteError(error, 'Error updating team orders');
  }
}
