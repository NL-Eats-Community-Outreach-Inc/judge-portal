import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import {
  courses as coursesTable,
  modules as modulesTable,
  lessons as lessonsTable,
} from '@/lib/db/schema';

/**
 * Learner Catalogue API
 *
 * Returns the course catalogue with each course's associated modules and lessons.
 *
 * This endpoint:
 * 1. Authenticates the learner.
 * 2. Retrieves all courses.
 * 3. Retrieves modules belonging to those courses.
 * 4. Retrieves lessons belonging to those modules.
 * 5. Assembles and returns the nested course catalogue.
 */
export async function GET() {
  try {
    // 1. Authenticate the learner before exposing catalogue data.
    const user = await authServer.requireLearner();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'UNAUTHORIZED');
    }

    // 2. Retrieve all courses that form the catalogue.
    const courses = await db.select().from(coursesTable);

    const courseIds = courses.map((course) => course.id);

    // 3. Retrieve modules associated with the retrieved courses.
    const modules = courseIds.length
      ? await db.select().from(modulesTable).where(inArray(modulesTable.courseId, courseIds))
      : [];

    const moduleIds = modules.map((module) => module.id);

    // 4. Retrieve lessons associated with the retrieved modules.
    const lessons = moduleIds.length
      ? await db.select().from(lessonsTable).where(inArray(lessonsTable.moduleId, moduleIds))
      : [];

    // 5. Assemble each course with its matching modules and lessons.
    const result = courses.map((course) => {
      const courseModules = modules.filter((module) => module.courseId === course.id);

      const ids = new Set(courseModules.map((module) => module.id));

      return {
        course,
        modules: courseModules,
        lessons: lessons.filter((lesson) => ids.has(lesson.moduleId)),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, 'Error fetching learner catalogue');
  }
}
