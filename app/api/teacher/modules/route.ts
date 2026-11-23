import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { courses, modules } from '@/lib/db/schema';
import { handleRouteError, sendApiError } from '@/lib/utils/api-errors';
import { createSlug, createUniqueSlug } from '@/lib/utils/slug';

export async function GET(request: Request) {
  try {
    await authServer.requireTeacher();
    const courseSlug = new URL(request.url).searchParams.get('courseSlug');
    if (!courseSlug) return sendApiError(400, 'BAD_REQUEST', 'courseSlug is required');
    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);
    if (!course) return sendApiError(404, 'NOT_FOUND', 'Course not found');
    const list = await db
      .select()
      .from(modules)
      .where(eq(modules.courseId, course.id))
      .orderBy(asc(modules.order));
    return NextResponse.json(list);
  } catch (error) {
    return handleRouteError(error, 'Error fetching teacher modules');
  }
}

export async function POST(request: Request) {
  try {
    await authServer.requireTeacher();
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return sendApiError(400, 'BAD_REQUEST', 'Invalid request body');
    const data = body as Record<string, unknown>;
    if (typeof data.courseSlug !== 'string' || !data.courseSlug)
      return sendApiError(422, 'VALIDATION_ERROR', 'A courseSlug is required');
    if (typeof data.title !== 'string' || !data.title.trim())
      return sendApiError(422, 'VALIDATION_ERROR', 'Module title is required');
    const title = data.title.trim();
    if (title.length > 200)
      return sendApiError(422, 'VALIDATION_ERROR', 'Module title must be 200 characters or fewer');
    if (
      data.description !== undefined &&
      data.description !== null &&
      typeof data.description !== 'string'
    )
      return sendApiError(422, 'VALIDATION_ERROR', 'Description must be a string');
    const description =
      typeof data.description === 'string' ? data.description.trim() || null : null;
    if (description && description.length > 5000)
      return sendApiError(422, 'VALIDATION_ERROR', 'Description must be 5000 characters or fewer');

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, data.courseSlug))
      .limit(1);
    if (!course) return sendApiError(404, 'NOT_FOUND', 'Course not found');

    const baseSlug = createSlug(
      typeof data.slug === 'string' && data.slug.trim() ? data.slug : title
    );
    if (!baseSlug)
      return sendApiError(422, 'VALIDATION_ERROR', 'A valid module slug could not be generated');
    const existing = await db
      .select({ slug: modules.slug, order: modules.order })
      .from(modules)
      .where(eq(modules.courseId, course.id))
      .orderBy(asc(modules.order));
    const slug = createUniqueSlug(
      baseSlug,
      existing.map((item) => item.slug)
    );
    const order = existing.length ? Math.max(...existing.map((item) => item.order)) + 1 : 0;
    const [created] = await db
      .insert(modules)
      .values({ courseId: course.id, title, description, slug, order })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Error creating teacher module');
  }
}
