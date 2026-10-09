import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { learnerProgress as learnerProgressTable } from '@/lib/db/schema';

export async function GET() {
  try {
    const user = await authServer.getUser();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'Unauthorized');
    }

    const progress = await db
      .select()
      .from(learnerProgressTable)
      .where(eq(learnerProgressTable.userId, user.id));

    return NextResponse.json(progress);
  } catch (error) {
    return handleRouteError(error, 'Error fetching learner progress');
  }
}

export async function POST(request: Request) {
  try {
    const user = await authServer.getUser();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'Unauthorized');
    }

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
