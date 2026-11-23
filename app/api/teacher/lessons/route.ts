import { NextRequest, NextResponse } from 'next/server';
import { asc, and, eq } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { courses, lessons, modules } from '@/lib/db/schema';
import { sanityWriteClient } from '@/lib/sanity/write-client';
import { handleRouteError, sendApiError } from '@/lib/utils/api-errors';
import { createSlug, createUniqueSlug } from '@/lib/utils/slug';

export async function GET(request: NextRequest) {
  try {
    await authServer.requireTeacher();
    const courseSlug = request.nextUrl.searchParams.get('courseSlug');
    const moduleSlug = request.nextUrl.searchParams.get('moduleSlug');
    if (!courseSlug || !moduleSlug)
      return sendApiError(400, 'BAD_REQUEST', 'courseSlug and moduleSlug are required');
    const [module] = await db
      .select({ id: modules.id })
      .from(modules)
      .innerJoin(courses, eq(modules.courseId, courses.id))
      .where(and(eq(courses.slug, courseSlug), eq(modules.slug, moduleSlug)))
      .limit(1);
    if (!module) return sendApiError(404, 'MODULE_NOT_FOUND', 'Module not found');
    const moduleLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.moduleId, module.id))
      .orderBy(asc(lessons.order));
    return NextResponse.json({ lessons: moduleLessons });
  } catch (error) {
    return handleRouteError(error, 'GET /api/teacher/lessons');
  }
}

export async function POST(request: NextRequest) {
  let sanityDocumentId: string | undefined;
  try {
    await authServer.requireTeacher();
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return sendApiError(400, 'BAD_REQUEST', 'Invalid request body');
    const data = body as Record<string, unknown>;
    const { courseSlug, moduleSlug, title, description, slug } = data;
    if (typeof courseSlug !== 'string' || typeof moduleSlug !== 'string')
      return sendApiError(422, 'VALIDATION_ERROR', 'Course and module slugs are required');
    if (typeof title !== 'string' || !title.trim())
      return sendApiError(400, 'INVALID_TITLE', 'A lesson title is required');
    if (description !== undefined && description !== null && typeof description !== 'string')
      return sendApiError(400, 'INVALID_DESCRIPTION', 'Description must be a string');
    if (slug !== undefined && slug !== null && typeof slug !== 'string')
      return sendApiError(400, 'INVALID_SLUG', 'Slug must be a string');

    const [module] = await db
      .select({ id: modules.id })
      .from(modules)
      .innerJoin(courses, eq(modules.courseId, courses.id))
      .where(and(eq(courses.slug, courseSlug), eq(modules.slug, moduleSlug)))
      .limit(1);
    if (!module) return sendApiError(404, 'MODULE_NOT_FOUND', 'Module not found');

    const baseSlug = createSlug(typeof slug === 'string' && slug.trim() ? slug : title);
    if (!baseSlug)
      return sendApiError(400, 'INVALID_SLUG', 'A valid lesson slug could not be generated');
    const existing = await db
      .select({ slug: lessons.slug, order: lessons.order })
      .from(lessons)
      .where(eq(lessons.moduleId, module.id));
    const uniqueSlug = createUniqueSlug(
      baseSlug,
      existing.map((item) => item.slug)
    );
    const order = existing.length ? Math.max(...existing.map((item) => item.order)) + 1 : 0;

    const sanityDocument = await sanityWriteClient.create({
      _type: 'lesson',
      title: title.trim(),
      moduleId: module.id,
      contentBlocks: [],
    });
    sanityDocumentId = sanityDocument._id;
    const [createdLesson] = await db
      .insert(lessons)
      .values({
        moduleId: module.id,
        sanityDocumentId,
        title: title.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        slug: uniqueSlug,
        order,
      })
      .returning();
    return NextResponse.json({ lesson: createdLesson, sanityDocumentId }, { status: 201 });
  } catch (error) {
    if (sanityDocumentId) {
      try {
        await sanityWriteClient.delete(sanityDocumentId);
      } catch (cleanupError) {
        console.error(
          'Failed to clean up Sanity document after lesson creation failed:',
          cleanupError
        );
      }
    }
    return handleRouteError(error, 'POST /api/teacher/lessons');
  }
}
