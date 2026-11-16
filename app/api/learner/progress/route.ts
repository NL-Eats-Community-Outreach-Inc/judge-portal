import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { learnerProgress as learnerProgressTable } from '@/lib/db/schema';

/**
 * GET /api/learner/progress
 *
 * Retrieves the authenticated learner's lesson progress records.
 *
 * This endpoint:
 * 1. Checks that the requesting user is authenticated.
 * 2. Retrieves progress records belonging to that user.
 * 3. Returns the progress records as JSON.
 *
 * The frontend uses this data to determine which lessons are completed
 * and display the learner's course progress.
 */

export async function GET() {
  try {
    // 1.
    const user = await authServer.requireLearner();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'UNAUTHORIZED');
    }

    // 2.
    const progress = await db
      .select({
        lessonId: learnerProgressTable.lessonId,
        completed: learnerProgressTable.completed,
      })
      .from(learnerProgressTable)
      .where(eq(learnerProgressTable.userId, user.id));

    // 3.
    return NextResponse.json(progress);
  } catch (error) {
    return handleRouteError(error, 'Error fetching learner progress');
  }
}

/**
 * POST /api/learner/progress
 *
 * Marks a lesson as completed for the authenticated learner.
 *
 * This endpoint:
 * 1. Checks that the requesting user is authenticated.
 * 2. Reads the lesson ID from the request body.
 * 3. Validates that a lesson ID was provided.
 * 4. Inserts a completed progress record or updates the existing record.
 * 5. Returns a confirmation message and the updated progress record.
 *
 * The frontend calls this endpoint when a learner marks a lesson
 * as complete, allowing their progress to be saved in the database.
 */

export async function POST(request: Request) {
  try {
    // 1.
    const user = await authServer.getUser();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'Unauthorized');
    }

    // 2.
    const body = await request.json();
    const { lessonId } = body;

    // 3.
    if (!lessonId) {
      return sendApiError(400, 'BAD_REQUEST', 'Lesson ID is required');
    }

    // 4.
    const result = await db
      .insert(learnerProgressTable)
      .values({
        userId: user.id,
        lessonId,
        completed: true,
      })
      .onConflictDoUpdate({
        target: [learnerProgressTable.userId, learnerProgressTable.lessonId],
        set: {
          completed: true,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    // 5.
    return NextResponse.json({
      message: 'Progress updated',
      progress: result[0],
    });
  } catch (error) {
    return handleRouteError(error, 'Error updating learner progress');
  }
}
