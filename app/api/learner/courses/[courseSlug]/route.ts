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
 * Learner Course Detail API
 *
 * Returns one course together with its modules and lessons.
 *
 * This endpoint:
 * 1. Authenticates the learner.
 * 2. Resolves the course slug and retrieves the matching course.
 * 3. Retrieves modules belonging to that course.
 * 4. Retrieves lessons belonging to those modules.
 * 5. Returns the course detail payload used by the course overview.
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseSlug: string }> }
) {
  try {
    // 1. Authenticate the learner before allowing access to course content.
    const user = await authServer.requireLearner();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'UNAUTHORIZED');
    }

    // 2. Resolve the route slug and retrieve the matching course record.
    const { courseSlug } = await params;

    const [course] = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.slug, courseSlug))
      .limit(1);

    if (!course) {
      return sendApiError(404, 'NOT_FOUND', 'Course not found');
    }

    // 3. Retrieve the modules associated with the selected course.
    const modules = await db
      .select()
      .from(modulesTable)
      .where(eq(modulesTable.courseId, course.id));

    const moduleIds = modules.map((module) => module.id);

    // 4. Retrieve lessons associated with the selected course modules.
    const lessons = await db
      .select()
      .from(lessonsTable)
      .where(inArray(lessonsTable.moduleId, moduleIds));

    // 5. Return the course, modules, and lessons together.
    return NextResponse.json({
      course,
      modules,
      lessons,
    });
  } catch (error) {
    return handleRouteError(error, 'Error fetching course data');
  }
}
