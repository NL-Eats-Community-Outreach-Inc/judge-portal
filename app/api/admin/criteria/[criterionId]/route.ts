import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { criteria, events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { isUniqueOn } from '@/lib/db/errors';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ criterionId: string }> }
) {
  try {
    // Await params for Next.js 15+ compatibility
    const { criterionId } = await params;

    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);

    const { name, description, minScore, maxScore, displayOrder, weight, category } =
      await request.json();

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

    if (!Number.isInteger(displayOrder) || displayOrder < 1) {
      return sendApiError(400, 'BAD_REQUEST', 'Display order must be a whole number of at least 1');
    }

    if (!Number.isInteger(weight) || weight < 0 || weight > 100) {
      return sendApiError(400, 'BAD_REQUEST', 'Weight must be a whole number between 0 and 100');
    }

    if (!category || !['technical', 'business'].includes(category)) {
      return sendApiError(400, 'BAD_REQUEST', 'Category must be either "technical" or "business"');
    }

    // Get the current criterion and the status of its event
    const [currentCriterion] = await db
      .select({ id: criteria.id, eventId: criteria.eventId, eventStatus: events.status })
      .from(criteria)
      .innerJoin(events, eq(events.id, criteria.eventId))
      .where(eq(criteria.id, criterionId))
      .limit(1);

    if (!currentCriterion) {
      return sendApiError(404, 'NOT_FOUND', 'Criterion not found');
    }

    // Verify criterion's event belongs to org
    await requireEventInOrg(currentCriterion.eventId, orgId);

    // Category and range decide which scores count and how. The Criteria tab
    // disables editing once judging has started; this guard is what protects
    // the judges' work from a stale tab
    if (currentCriterion.eventStatus === 'active' || currentCriterion.eventStatus === 'completed') {
      return sendApiError(
        400,
        'INVALID_STATUS',
        'Criteria cannot be changed once judging has started'
      );
    }

    // Get all criteria in the same event to validate weight totals
    const allCriteria = await db
      .select()
      .from(criteria)
      .where(eq(criteria.eventId, currentCriterion.eventId));

    // Calculate current weight totals by category, excluding the criterion being updated
    const weightTotals = allCriteria
      .filter((c) => c.id !== criterionId)
      .reduce(
        (acc, crit) => {
          acc[crit.category] = (acc[crit.category] || 0) + crit.weight;
          return acc;
        },
        {} as Record<string, number>
      );

    // Add the new weight for the updated category
    const newWeightTotal = (weightTotals[category] || 0) + weight;

    // Validate that the category weight total won't exceed 100%
    if (newWeightTotal > 100) {
      return sendApiError(
        400,
        'BAD_REQUEST',
        `Cannot update criterion: ${category} category weights would total ${newWeightTotal}% (maximum 100%)`
      );
    }

    // Update criterion (updatedAt is handled automatically by schema)
    const [criterion] = await db
      .update(criteria)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        minScore,
        maxScore,
        displayOrder,
        weight,
        category,
      })
      .where(eq(criteria.id, criterionId))
      .returning();

    if (!criterion) {
      return sendApiError(404, 'NOT_FOUND', 'Criterion not found');
    }

    return NextResponse.json({ criterion });
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
        400,
        'DUPLICATE_DISPLAY_ORDER',
        'A criterion with this display order already exists'
      );
    }
    return handleRouteError(error, 'Error updating criterion');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ criterionId: string }> }
) {
  try {
    // Await params for Next.js 15+ compatibility
    const { criterionId } = await params;

    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);

    // Verify criterion's event belongs to org
    const [existingCriterion] = await db
      .select({ eventId: criteria.eventId, eventStatus: events.status })
      .from(criteria)
      .innerJoin(events, eq(events.id, criteria.eventId))
      .where(eq(criteria.id, criterionId))
      .limit(1);

    if (!existingCriterion) {
      return sendApiError(404, 'NOT_FOUND', 'Criterion not found');
    }

    await requireEventInOrg(existingCriterion.eventId, orgId);

    // Deleting a criterion cascades its scores. The Criteria tab disables the
    // control once judging has started; this guard is what protects the
    // judges' work from a stale tab
    if (
      existingCriterion.eventStatus === 'active' ||
      existingCriterion.eventStatus === 'completed'
    ) {
      return sendApiError(
        400,
        'INVALID_STATUS',
        'Criteria cannot be changed once judging has started'
      );
    }

    // Delete criterion (cascade will handle related scores)
    const [deletedCriterion] = await db
      .delete(criteria)
      .where(eq(criteria.id, criterionId))
      .returning();

    if (!deletedCriterion) {
      return sendApiError(404, 'NOT_FOUND', 'Criterion not found');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Error deleting criterion');
  }
}
