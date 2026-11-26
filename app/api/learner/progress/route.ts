import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { learnerProgress as learnerProgressTable } from '@/lib/db/schema';

/**
 * GET /api/learner/progress
 *
 * Retrieves the authenticated learner's lesson progress records.
 */
export async function GET() {
  try {
    const user = await authServer.requireAnyRole(['learner', 'teacher']);

    const progress = await db
      .select({
        lessonId: learnerProgressTable.lessonId,
        completed: learnerProgressTable.completed,
      })
      .from(learnerProgressTable)
      .where(eq(learnerProgressTable.userId, user.id));

    return NextResponse.json(progress);
  } catch (error) {
    return handleRouteError(error, 'Error fetching learner progress');
  }
}

/**
 * POST /api/learner/progress
 *
 * Marks a lesson as completed for the authenticated learner.
 */
export async function POST(request: Request) {
  try {
    const user = await authServer.requireAnyRole(['learner', 'teacher']);

    const body = await request.json();
    const { lessonId } = body;

    if (!lessonId) {
      return sendApiError(400, 'BAD_REQUEST', 'Lesson ID is required');
    }

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

    return NextResponse.json({
      message: 'Progress updated',
      progress: result[0],
    });
  } catch (error) {
    return handleRouteError(error, 'Error updating learner progress');
  }
}
