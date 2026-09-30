import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { criteria, events } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { isUniqueOn } from '@/lib/db/errors';

export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    // Build query with org-scoped conditions
    let allCriteria;
    if (eventId) {
      await requireEventInOrg(eventId, orgId);
      allCriteria = await db
        .select()
        .from(criteria)
        .where(eq(criteria.eventId, eventId))
        .orderBy(criteria.displayOrder);
    } else {
      allCriteria = await db
        .select({
          id: criteria.id,
          eventId: criteria.eventId,
          name: criteria.name,
          description: criteria.description,
          minScore: criteria.minScore,
          maxScore: criteria.maxScore,
          displayOrder: criteria.displayOrder,
          weight: criteria.weight,
          category: criteria.category,
          createdAt: criteria.createdAt,
          updatedAt: criteria.updatedAt,
        })
        .from(criteria)
        .innerJoin(events, eq(criteria.eventId, events.id))
        .where(eq(events.organizationId, orgId))
        .orderBy(criteria.displayOrder);
    }

    return NextResponse.json({ criteria: allCriteria });
  } catch (error) {
    return handleRouteError(error, 'Error fetching criteria');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();
    const { eventId, name, description, minScore, maxScore, weight, category } =
      await request.json();

    if (!eventId) {
      return sendApiError(400, 'BAD_REQUEST', 'Event ID is required');
    }

    const orgId = await getAdminOrgId(user.id);
    await requireEventInOrg(eventId, orgId);

    if (!name || !name.trim()) {
      return sendApiError(400, 'BAD_REQUEST', 'Criteria name is required');
    }

    // Scores are whole numbers (judges pick integers; the column is an integer)
    if (!Number.isInteger(minScore) || !Number.isInteger(maxScore)) {
      return sendApiError(400, 'BAD_REQUEST', 'Min and max scores must be whole numbers');
    }

    if (minScore >= maxScore) {
      return sendApiError(400, 'BAD_REQUEST', 'Min score must be less than max score');
    }

    if (!Number.isInteger(weight) || weight < 0 || weight > 100) {
      return sendApiError(400, 'BAD_REQUEST', 'Weight must be a whole number between 0 and 100');
    }

    if (!category || !['technical', 'business'].includes(category)) {
      return sendApiError(400, 'BAD_REQUEST', 'Category must be either "technical" or "business"');
    }

    // Verify event exists
    const [event] = await db
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return sendApiError(400, 'BAD_REQUEST', 'Event not found');
    }

    // Criteria decide which scores count. The Criteria tab disables the
    // controls once judging has started; this guard is what protects the
    // judges' work from a stale tab
    if (event.status === 'active' || event.status === 'completed') {
      return sendApiError(
        400,
        'INVALID_STATUS',
        'Criteria cannot be changed once judging has started'
      );
    }

    return await db.transaction(async (tx) => {
      // Lock per event so two admins adding criteria at the same time are
      // serialised and never compute the same display order (or a weight
      // total that only holds for one of them).
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`);

      // Get existing criteria for weight validation and display order
      const existingCriteria = await tx
        .select()
        .from(criteria)
        .where(eq(criteria.eventId, eventId));

      const nextDisplayOrder =
        existingCriteria.length > 0
          ? Math.max(...existingCriteria.map((c) => c.displayOrder)) + 1
          : 1;

      // Calculate current weight totals by category
      const weightTotals = existingCriteria.reduce(
        (acc, crit) => {
          acc[crit.category] = (acc[crit.category] || 0) + crit.weight;
          return acc;
        },
        {} as Record<string, number>
      );

      // Add the new criterion's weight to the appropriate category
      const newWeightTotal = (weightTotals[category] || 0) + weight;

      // Validate that the category weight total won't exceed 100%
      if (newWeightTotal > 100) {
        return sendApiError(
          400,
          'BAD_REQUEST',
          `Cannot add criterion: ${category} category weights would total ${newWeightTotal}% (maximum 100%)`
        );
      }

      // Create new criterion
      const [criterion] = await tx
        .insert(criteria)
        .values({
          eventId,
          name: name.trim(),
          description: description?.trim() || null,
          minScore,
          maxScore,
          displayOrder: nextDisplayOrder,
          weight,
          category,
        })
        .returning();

      return NextResponse.json({ criterion }, { status: 201 });
    });
  } catch (error) {
    if (isUniqueOn(error, 'event_id', 'name')) {
      return sendApiError(
        400,
        'DUPLICATE_CRITERION_NAME',
        'A criterion with this name already exists'
      );
    }
    if (isUniqueOn(error, 'event_id', 'display_order')) {
      return sendApiError(
        409,
        'CONFLICT',
        'A criterion with this display order already exists. Please try again'
      );
    }
    return handleRouteError(error, 'Error creating criterion');
  }
}
