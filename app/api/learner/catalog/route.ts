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

export async function GET() {
  try {
    const user = await authServer.getUser();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'Unauthorized');
    }

    // Query 1: all courses.
    const courses = await db.select().from(coursesTable);

    const courseIds = courses.map((course) => course.id);

    // Query 2: all modules belonging to those courses.
    const modules = courseIds.length
      ? await db.select().from(modulesTable).where(inArray(modulesTable.courseId, courseIds))
      : [];

    const moduleIds = modules.map((module) => module.id);

    // Query 3: all lessons belonging to those modules.
    const lessons = moduleIds.length
      ? await db.select().from(lessonsTable).where(inArray(lessonsTable.moduleId, moduleIds))
      : [];

    // Assemble the same CourseDetail shape the pages already use.
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
