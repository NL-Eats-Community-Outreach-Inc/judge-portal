import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { courses as coursesTable } from '@/lib/db/schema';

/**
 * GET /api/learner/courses
 *
 * Fetches the list of courses from the database.
 *
 * This endpoint:
 * 1. Authenticates the requesting user.
 * 2. Retrieves all courses from the database.
 * 3. Returns the courses as JSON.
 *
 * The frontend uses this data to display the available courses
 * in the learner catalogue.
 */

export async function GET() {
  try {
    // 1.
    const user = await authServer.requireLearner();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'UNAUTHORIZED');
    }
    // 2.
    const courses = await db.select().from(coursesTable);

    // 3.
    return NextResponse.json(courses);
  } catch (error) {
    return handleRouteError(error, 'caught error no user');
  }
}
