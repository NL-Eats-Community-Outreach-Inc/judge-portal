import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { courses } from '@/lib/db/schema';
import { handleRouteError, sendApiError } from '@/lib/utils/api-errors';
import { createSlug, createUniqueSlug } from '@/lib/utils/slug';

export async function GET() {
  try {
    await authServer.requireTeacher();
    const courseList = await db.select().from(courses).orderBy(asc(courses.createdAt));
    return NextResponse.json(courseList);
  } catch (error) {
    return handleRouteError(error, 'Error fetching teacher courses');
  }
}

export async function POST(request: Request) {
  try {
    await authServer.requireTeacher();
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid request body');
    }
    const data = body as Record<string, unknown>;
    if (typeof data.title !== 'string' || !data.title.trim()) {
      return sendApiError(422, 'VALIDATION_ERROR', 'Course title is required');
    }
    const title = data.title.trim();
    if (title.length > 200) {
      return sendApiError(422, 'VALIDATION_ERROR', 'Course title must be 200 characters or fewer');
    }
    if (
      data.description !== undefined &&
      data.description !== null &&
      typeof data.description !== 'string'
    ) {
      return sendApiError(422, 'VALIDATION_ERROR', 'Description must be a string');
    }
    const description =
      typeof data.description === 'string' ? data.description.trim() || null : null;
    if (description && description.length > 5000) {
      return sendApiError(422, 'VALIDATION_ERROR', 'Description must be 5000 characters or fewer');
    }
    const baseSlug = createSlug(
      typeof data.slug === 'string' && data.slug.trim() ? data.slug : title
    );
    if (!baseSlug || baseSlug.length > 200) {
      return sendApiError(422, 'VALIDATION_ERROR', 'A valid course slug could not be generated');
    }
    const existing = await db.select({ slug: courses.slug }).from(courses);
    const slug = createUniqueSlug(
      baseSlug,
      existing.map((course) => course.slug)
    );
    const [createdCourse] = await db
      .insert(courses)
      .values({ title, description, slug })
      .returning();
    return NextResponse.json(createdCourse, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Error creating teacher course');
  }
}
