import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { learnerProgress as learnerProgressTable } from '@/lib/db/schema';

/**
 * Learner Progress API
 *
 * Provides read and write access to the authenticated user's lesson progress.
 *
 * GET endpoint:
 * 1. Authenticates the learner.
 * 2. Retrieves that learner's progress records.
 * 3. Returns the progress records as JSON.
 *
 * POST endpoint:
 * 4. Authenticates the requesting user.
 * 5. Reads and validates the lesson ID from the request body.
 * 6. Inserts or updates the lesson's completed progress record.
 * 7. Returns a confirmation and the saved progress record.
 */

export async function GET() {
  try {
    // 1. Authenticate the learner before reading progress records.
    const user = await authServer.requireLearner();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'UNAUTHORIZED');
    }

    // 2. Retrieve only progress records belonging to the authenticated learner.
    const progress = await db
      .select({
        lessonId: learnerProgressTable.lessonId,
        completed: learnerProgressTable.completed,
      })
      .from(learnerProgressTable)
      .where(eq(learnerProgressTable.userId, user.id));

    // 3. Return the learner's saved progress records.
    return NextResponse.json(progress);
  } catch (error) {
    return handleRouteError(error, 'Error fetching learner progress');
  }
}

export async function POST(request: Request) {
  try {
    // 4. Authenticate the user before changing lesson progress.
    const user = await authServer.getUser();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'Unauthorized');
    }

    // 5. Read the lesson ID from the submitted request body.
    const body = await request.json();
    const { lessonId } = body;

    // 6. Require a lesson ID before saving progress.
    if (!lessonId) {
      return sendApiError(400, 'BAD_REQUEST', 'Lesson ID is required');
    }

    // 7. Insert a completed record or mark the existing record completed.
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

    // Return the saved progress record and confirmation.
    return NextResponse.json({
      message: 'Progress updated',
      progress: result[0],
    });
  } catch (error) {
    return handleRouteError(error, 'Error updating learner progress');
  }
}
