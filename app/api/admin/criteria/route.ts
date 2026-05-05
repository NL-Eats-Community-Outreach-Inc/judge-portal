import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { criteria, events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError } from '@/lib/utils/api-errors';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

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
    console.error('Error fetching criteria:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

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

    if (typeof minScore !== 'number' || typeof maxScore !== 'number') {
      return sendApiError(400, 'BAD_REQUEST', 'Min and max scores must be numbers');
    }

    if (minScore >= maxScore) {
      return sendApiError(400, 'BAD_REQUEST', 'Min score must be less than max score');
    }

    if (typeof weight !== 'number' || weight < 0 || weight > 100) {
      return sendApiError(400, 'BAD_REQUEST', 'Weight must be a number between 0 and 100');
    }

    if (!category || !['technical', 'business'].includes(category)) {
      return sendApiError(400, 'BAD_REQUEST', 'Category must be either "technical" or "business"');
    }

    // Verify event exists
    const event = await db.select().from(events).where(eq(events.id, eventId)).limit(1);

    if (event.length === 0) {
      return sendApiError(400, 'BAD_REQUEST', 'Event not found');
    }

    // Get existing criteria for weight validation and display order
    const existingCriteria = await db.select().from(criteria).where(eq(criteria.eventId, eventId));

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
    const [criterion] = await db
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

    return NextResponse.json({ criterion });
  } catch (error) {
    console.error('Error creating criterion:', error);

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
