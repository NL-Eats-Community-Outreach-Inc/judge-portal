import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { courses as coursesTable } from '@/lib/db/schema';

/**
 * Learner Courses API
 *
 * Returns course records available to an authenticated learner.
 *
 * This endpoint:
 * 1. Authenticates the learner.
 * 2. Retrieves all course records.
 * 3. Returns the course list as JSON.
 */

export async function GET() {
  try {
    // 1. Authenticate the learner before retrieving course data.
    const user = await authServer.requireLearner();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'UNAUTHORIZED');
    }

    // 2. Retrieve all course records from the database.
    const courses = await db.select().from(coursesTable);

    // 3. Return the course records to the catalogue client.
    return NextResponse.json(courses);
  } catch (error) {
    return handleRouteError(error, 'caught error no user');
  }
}
