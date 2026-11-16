import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import {
  courses as coursesTable,
  modules as modulesTable,
  lessons as lessonsTable,
} from '@/lib/db/schema';

/**
 * GET /api/learner/courses/[courseId]
 *
 * Fetches a course and its associated modules and lessons.
 *
 * This endpoint:
 * 1. Checks that the user is authenticated.
 * 2. Retrieves the requested course by its ID.
 * 3. Retrieves all modules belonging to that course.
 * 4. Retrieves all lessons belonging to those modules.
 * 5. Returns the course, modules, and lessons as JSON.
 *
 * The frontend uses this data to display the course overview and its
 * expandable module/lesson list.
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseSlug: string }> }
) {
  try {
    // 1.
    const user = await authServer.requireLearner();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'UNAUTHORIZED');
    }

    // 2.
    const { courseSlug } = await params;

    const [course] = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.slug, courseSlug))
      .limit(1);

    if (!course) {
      return sendApiError(404, 'NOT_FOUND', 'Course not found');
    }

    // 3.
    const modules = await db
      .select()
      .from(modulesTable)
      .where(eq(modulesTable.courseId, course.id));

    const moduleIds = modules.map((module) => module.id);

    // 4.
    const lessons = await db
      .select()
      .from(lessonsTable)
      .where(inArray(lessonsTable.moduleId, moduleIds));

    // 5.
    return NextResponse.json({
      course,
      modules,
      lessons,
    });
  } catch (error) {
    return handleRouteError(error, 'Error fetching course data');
  }
}
