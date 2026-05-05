import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { criteria } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError } from '@/lib/utils/api-errors';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const orgId = await getAdminOrgId(user.id);
    const { eventId, criteriaOrders } = await request.json();

    if (!eventId) {
      return sendApiError(400, 'BAD_REQUEST', 'Event ID is required');
    }

    try {
      await requireEventInOrg(eventId, orgId);
    } catch (error: any) {
      const status = error.status || error.statusCode || 403;
      const code = status === 404 ? 'NOT_FOUND' : 'FORBIDDEN';
      return sendApiError(status, code, error.message || 'Access to event denied');
    }

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

    // Use a transaction to avoid unique constraint violations
    const updatedCriteria = await db.transaction(async (tx) => {
      // First, update all affected criteria to temporary high values (add 1000 to avoid conflicts)
      const tempUpdatePromises = criteriaOrders.map(({ id }) =>
        tx
          .update(criteria)
          .set({ displayOrder: Math.floor(1000 + Math.random() * 1000) }) // Use random high integer values to avoid any conflicts
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
    console.error('Error updating criteria orders:', error);

    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('duplicate key')) {
      if (error.message.includes('criteria_event_id_display_order')) {
        return sendApiError(400, 'BAD_REQUEST', 'Duplicate display order detected');
      }
    }

    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}
