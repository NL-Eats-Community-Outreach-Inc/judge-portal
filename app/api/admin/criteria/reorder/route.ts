import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { criteria, events } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { isUniqueOn } from '@/lib/db/errors';

export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();

    const orgId = await getAdminOrgId(user.id);
    const { eventId, criteriaOrders } = await request.json();

    if (!eventId) {
      return sendApiError(400, 'BAD_REQUEST', 'Event ID is required');
    }

    await requireEventInOrg(eventId, orgId);

    if (!Array.isArray(criteriaOrders) || criteriaOrders.length === 0) {
      return sendApiError(400, 'BAD_REQUEST', 'Criteria orders array is required');
    }

    // Validate criteria orders structure
    for (const criteriaOrder of criteriaOrders) {
      if (!criteriaOrder.id || typeof criteriaOrder.displayOrder !== 'number') {
        return sendApiError(
          400,
          'BAD_REQUEST',
          'Each criteria order must have id and displayOrder'
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

    // The Criteria tab disables dragging once judging has started; this guard
    // is what protects the judges' view from a stale tab
    if (event.status === 'active' || event.status === 'completed') {
      return sendApiError(
        400,
        'INVALID_STATUS',
        'Criteria cannot be changed once judging has started'
      );
    }

    // Use a transaction to avoid unique constraint violations
    const updatedCriteria = await db.transaction(async (tx) => {
      // First, park every affected criterion on a distinct negative order: real
      // orders are positive, so the temporaries cannot collide with them or each other
      const tempUpdatePromises = criteriaOrders.map(({ id }, index) =>
        tx
          .update(criteria)
          .set({ displayOrder: -(index + 1) })
          .where(and(eq(criteria.id, id), eq(criteria.eventId, eventId)))
      );

      await Promise.all(tempUpdatePromises);

      // Then update to final values
      const finalUpdatePromises = criteriaOrders.map(({ id, displayOrder }) =>
        tx
          .update(criteria)
          .set({ displayOrder })
          .where(and(eq(criteria.id, id), eq(criteria.eventId, eventId)))
          .returning()
      );

      const results = await Promise.all(finalUpdatePromises);
      return results.flat();
    });

    // Check if all updates were successful
    if (updatedCriteria.length !== criteriaOrders.length) {
      return sendApiError(400, 'BAD_REQUEST', 'Some criteria could not be updated');
    }

    return NextResponse.json({
      message: 'Criteria orders updated successfully',
      updatedCriteria,
    });
  } catch (error) {
    if (isUniqueOn(error, 'event_id', 'display_order')) {
      return sendApiError(409, 'CONFLICT', 'Duplicate display order detected');
    }
    return handleRouteError(error, 'Error updating criteria orders');
  }
}
