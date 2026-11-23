import { NextResponse } from 'next/server';
import { and, asc, eq, ne } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { courses, modules, lessons } from '@/lib/db/schema';
import { sanityWriteClient } from '@/lib/sanity/write-client';
import { handleRouteError, sendApiError } from '@/lib/utils/api-errors';
import { createSlug, createUniqueSlug } from '@/lib/utils/slug';

type RouteContext = { params: Promise<{ moduleSlug: string }> };

async function findModule(moduleSlug: string, courseSlug: string | null) {
  if (!courseSlug) return null;
  const [result] = await db
    .select({ module: modules })
    .from(modules)
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(and(eq(modules.slug, moduleSlug), eq(courses.slug, courseSlug)))
    .limit(1);
  return result?.module ?? null;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await authServer.requireTeacher();
    const { moduleSlug } = await params;
    const courseSlug = new URL(request.url).searchParams.get('courseSlug');
    const moduleData = await findModule(moduleSlug, courseSlug);
    if (!moduleData) return sendApiError(404, 'NOT_FOUND', 'Module not found');
    const moduleLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.moduleId, moduleData.id))
      .orderBy(asc(lessons.order));
    return NextResponse.json({ module: moduleData, lessons: moduleLessons });
  } catch (error) {
    return handleRouteError(error, 'Error fetching teacher module');
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await authServer.requireTeacher();
    const { moduleSlug } = await params;
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return sendApiError(400, 'BAD_REQUEST', 'Invalid request body');
    const data = body as Record<string, unknown>;
    const courseSlug =
      typeof data.courseSlug === 'string'
        ? data.courseSlug
        : new URL(request.url).searchParams.get('courseSlug');
    const existing = await findModule(moduleSlug, courseSlug);
    if (!existing) return sendApiError(404, 'NOT_FOUND', 'Module not found');

    const updates: { title?: string; description?: string | null; slug?: string; order?: number } =
      {};
    if (Object.hasOwn(data, 'title')) {
      if (typeof data.title !== 'string' || !data.title.trim() || data.title.trim().length > 200)
        return sendApiError(
          422,
          'VALIDATION_ERROR',
          'Module title must be between 1 and 200 characters'
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
    if (Object.hasOwn(data, 'order')) {
      if (typeof data.order !== 'number' || !Number.isInteger(data.order) || data.order < 0)
        return sendApiError(422, 'VALIDATION_ERROR', 'Order must be a non-negative integer');
      updates.order = data.order;
    }
    const slugSource = Object.hasOwn(data, 'slug') ? data.slug : updates.title;
    if (slugSource !== undefined) {
      if (typeof slugSource !== 'string')
        return sendApiError(422, 'VALIDATION_ERROR', 'Module slug must be a string');
      const baseSlug = createSlug(slugSource);
      if (!baseSlug) return sendApiError(422, 'VALIDATION_ERROR', 'Invalid module slug');
      const others = await db
        .select({ slug: modules.slug })
        .from(modules)
        .where(and(eq(modules.courseId, existing.courseId), ne(modules.id, existing.id)));
      updates.slug = createUniqueSlug(
        baseSlug,
        others.map((item) => item.slug)
      );
    }
    if (!Object.keys(updates).length)
      return sendApiError(400, 'BAD_REQUEST', 'No valid fields provided');
    const [updated] = await db
      .update(modules)
      .set(updates)
      .where(eq(modules.id, existing.id))
      .returning();
    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error, 'Error updating teacher module');
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    await authServer.requireTeacher();
    const { moduleSlug } = await params;
    const courseSlug = new URL(request.url).searchParams.get('courseSlug');
    const moduleData = await findModule(moduleSlug, courseSlug);
    if (!moduleData) return sendApiError(404, 'NOT_FOUND', 'Module not found');
    const moduleLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.moduleId, moduleData.id));
    const cleanup = await Promise.allSettled(
      moduleLessons
        .filter((lesson) => lesson.sanityDocumentId)
        .map((lesson) => sanityWriteClient.delete(lesson.sanityDocumentId!))
    );
    if (cleanup.some((result) => result.status === 'rejected')) {
      return sendApiError(
        500,
        'SANITY_CLEANUP_FAILED',
        'Lesson content could not be deleted. The module was retained.'
      );
    }
    await db.delete(lessons).where(eq(lessons.moduleId, moduleData.id));
    await db.delete(modules).where(eq(modules.id, moduleData.id));
    return NextResponse.json({ success: true, deletedLessons: moduleLessons.length });
  } catch (error) {
    return handleRouteError(error, 'Error deleting teacher module');
  }
}
