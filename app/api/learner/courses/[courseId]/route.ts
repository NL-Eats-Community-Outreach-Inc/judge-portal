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

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const user = await authServer.getUser();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'Unauthorized');
    }

    const { courseId } = await params;

    const [course] = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .limit(1);

    if (!course) {
      return sendApiError(404, 'NOT_FOUND', 'Course not found');
    }
    const modules = await db.select().from(modulesTable).where(eq(modulesTable.courseId, courseId));

    const moduleIds = modules.map((module) => module.id);

    const lessons = await db
      .select()
      .from(lessonsTable)
      .where(inArray(lessonsTable.moduleId, moduleIds));

    return NextResponse.json({
      course,
      modules,
      lessons,
    });
  } catch (error) {
    return handleRouteError(error, 'Error fetching course data');
  }
}
