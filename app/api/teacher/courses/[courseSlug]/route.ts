import { NextResponse } from 'next/server';
import { asc, eq, inArray, ne } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { courses, modules, lessons } from '@/lib/db/schema';
import { sanityWriteClient } from '@/lib/sanity/write-client';
import { handleRouteError, sendApiError } from '@/lib/utils/api-errors';
import { createSlug, createUniqueSlug } from '@/lib/utils/slug';

type RouteContext = { params: Promise<{ courseSlug: string }> };

async function findCourseBySlug(courseSlug: string) {
  const [course] = await db.select().from(courses).where(eq(courses.slug, courseSlug)).limit(1);
  return course;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await authServer.requireTeacher();
    const { courseSlug } = await params;
    const course = await findCourseBySlug(courseSlug);
    if (!course) return sendApiError(404, 'NOT_FOUND', 'Course not found');

    const courseModules = await db
      .select()
      .from(modules)
      .where(eq(modules.courseId, course.id))
      .orderBy(asc(modules.order));
    const moduleIds = courseModules.map((module) => module.id);
    const courseLessons = moduleIds.length
      ? await db
          .select()
          .from(lessons)
          .where(inArray(lessons.moduleId, moduleIds))
          .orderBy(asc(lessons.order))
      : [];

    return NextResponse.json({ course, modules: courseModules, lessons: courseLessons });
  } catch (error) {
    return handleRouteError(error, 'Error fetching teacher course');
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await authServer.requireTeacher();
    const { courseSlug } = await params;
    const existingCourse = await findCourseBySlug(courseSlug);
    if (!existingCourse) return sendApiError(404, 'NOT_FOUND', 'Course not found');

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid request body');
    }
    const data = body as Record<string, unknown>;
    const updates: { title?: string; description?: string | null; slug?: string } = {};

    if (Object.hasOwn(data, 'title')) {
      if (typeof data.title !== 'string' || !data.title.trim() || data.title.trim().length > 200)
        return sendApiError(
          422,
          'VALIDATION_ERROR',
          'Course title must be between 1 and 200 characters'
        );
      updates.title = data.title.trim();
    }
    if (Object.hasOwn(data, 'description')) {
      if (data.description !== null && typeof data.description !== 'string')
        return sendApiError(422, 'VALIDATION_ERROR', 'Description must be a string or null');
      if (typeof data.description === 'string' && data.description.trim().length > 5000)
        return sendApiError(
          422,
          'VALIDATION_ERROR',
          'Description must be 5000 characters or fewer'
        );
      updates.description =
        typeof data.description === 'string' ? data.description.trim() || null : null;
    }
    const slugSource = Object.hasOwn(data, 'slug') ? data.slug : updates.title;
    if (slugSource !== undefined) {
      if (typeof slugSource !== 'string')
        return sendApiError(422, 'VALIDATION_ERROR', 'Course slug must be a string');
      const baseSlug = createSlug(slugSource);
      if (!baseSlug || baseSlug.length > 200)
        return sendApiError(422, 'VALIDATION_ERROR', 'Invalid course slug');
      const others = await db
        .select({ slug: courses.slug })
        .from(courses)
        .where(ne(courses.id, existingCourse.id));
      updates.slug = createUniqueSlug(
        baseSlug,
        others.map((item) => item.slug)
      );
    }
    if (!Object.keys(updates).length)
      return sendApiError(400, 'BAD_REQUEST', 'No valid fields provided for update');

    const [updated] = await db
      .update(courses)
      .set(updates)
      .where(eq(courses.id, existingCourse.id))
      .returning();
    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error, 'Error updating teacher course');
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    await authServer.requireTeacher();
    const { courseSlug } = await params;
    const course = await findCourseBySlug(courseSlug);
    if (!course) return sendApiError(404, 'NOT_FOUND', 'Course not found');

    const courseModules = await db
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.courseId, course.id));
    const moduleIds = courseModules.map((module) => module.id);
    const courseLessons = moduleIds.length
      ? await db
          .select({ sanityDocumentId: lessons.sanityDocumentId })
          .from(lessons)
          .where(inArray(lessons.moduleId, moduleIds))
      : [];
    const documentIds = courseLessons
      .map((lesson) => lesson.sanityDocumentId)
      .filter((id): id is string => Boolean(id));
    const cleanup = await Promise.allSettled(documentIds.map((id) => sanityWriteClient.delete(id)));
    if (cleanup.some((result) => result.status === 'rejected')) {
      console.error('Failed to clean up Sanity documents for course:', course.id);
      return sendApiError(
        500,
        'SANITY_CLEANUP_FAILED',
        'Some lesson content could not be deleted. The course records were retained.'
      );
    }
    await db.transaction(async (tx) => {
      if (moduleIds.length) await tx.delete(lessons).where(inArray(lessons.moduleId, moduleIds));
      await tx.delete(modules).where(eq(modules.courseId, course.id));
      await tx.delete(courses).where(eq(courses.id, course.id));
    });
    return NextResponse.json({
      success: true,
      deletedModules: courseModules.length,
      deletedLessons: courseLessons.length,
      deletedSanityDocuments: documentIds.length,
    });
  } catch (error) {
    return handleRouteError(error, 'Error deleting teacher course');
  }
}
