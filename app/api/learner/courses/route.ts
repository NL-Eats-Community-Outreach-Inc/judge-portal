import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { courses as coursesTable } from '@/lib/db/schema';

export async function GET() {
  try {
    const user = await authServer.getUser();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'Unauthorized');
    }

    const courses = await db.select().from(coursesTable);

    return NextResponse.json(courses);

  } catch (error) {
    return handleRouteError(error, 'caught error no user');
  }
}

export async function POST() {
  //TODO
}
