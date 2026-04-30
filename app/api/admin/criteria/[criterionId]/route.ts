import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { criteria } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError } from '@/lib/utils/api-errors';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ criterionId: string }> }
) {
  try {
    // Await params for Next.js 15+ compatibility
    const { criterionId } = await params;

    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const orgId = await getAdminOrgId(user.id);

    const { name, description, minScore, maxScore, displayOrder, weight, category } =
      await request.json();

    if (!name || !name.trim()) {
      return sendApiError(400, 'BAD_REQUEST', 'Criteria name is required');
    }

    if (typeof minScore !== 'number' || typeof maxScore !== 'number') {
      return sendApiError(400, 'BAD_REQUEST', 'Min and max scores must be numbers');
    }

    if (minScore >= maxScore) {
      return sendApiError(400, 'BAD_REQUEST', 'Min score must be less than max score');
    }

    if (typeof displayOrder !== 'number') {
      return sendApiError(400, 'BAD_REQUEST', 'Display order must be a number');
    }

    if (typeof weight !== 'number' || weight < 0 || weight > 100) {
      return sendApiError(400, 'BAD_REQUEST', 'Weight must be a number between 0 and 100');
    }

    if (!category || !['technical', 'business'].includes(category)) {
      return sendApiError(400, 'BAD_REQUEST', 'Category must be either "technical" or "business"');
    }

    // Get the current criterion to check its current weight and category
    const [currentCriterion] = await db
      .select()
      .from(criteria)
      .where(eq(criteria.id, criterionId))
      .limit(1);

    if (!currentCriterion) {
      return sendApiError(404, 'NOT_FOUND', 'Criterion not found');
    }

    // Verify criterion's event belongs to org
    await requireEventInOrg(currentCriterion.eventId, orgId);

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
    console.error('Error updating criterion:', error);

    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('duplicate key')) {
      if (error.message.includes('criteria_event_id_name_key')) {
        return sendApiError(400, 'BAD_REQUEST', 'A criterion with this name already exists');
      }
      if (error.message.includes('criteria_event_id_display_order_key')) {
        return sendApiError(
          400,
          'BAD_REQUEST',
          'A criterion with this display order already exists'
        );
      }
    }

    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ criterionId: string }> }
) {
  try {
    // Await params for Next.js 15+ compatibility
    const { criterionId } = await params;

    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const orgId = await getAdminOrgId(user.id);

    // Verify criterion's event belongs to org
    const [existingCriterion] = await db
      .select({ eventId: criteria.eventId })
      .from(criteria)
      .where(eq(criteria.id, criterionId))
      .limit(1);

    if (!existingCriterion) {
      return sendApiError(404, 'NOT_FOUND', 'Criterion not found');
    }

    await requireEventInOrg(existingCriterion.eventId, orgId);

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
    console.error('Error deleting criterion:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}
