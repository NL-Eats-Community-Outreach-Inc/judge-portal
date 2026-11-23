import { NextRequest, NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { courses, lessons, modules } from '@/lib/db/schema';
import { sanityServerClient } from '@/lib/sanity/server-client';
import { sanityWriteClient } from '@/lib/sanity/write-client';
import { handleRouteError, sendApiError } from '@/lib/utils/api-errors';
import { createSlug, createUniqueSlug } from '@/lib/utils/slug';

type RouteContext = { params: Promise<{ lessonSlug: string }> };

async function findLesson(
  lessonSlug: string,
  courseSlug: string | null,
  moduleSlug: string | null
) {
  if (!courseSlug || !moduleSlug) return null;
  const [result] = await db
    .select({ lesson: lessons })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(
      and(eq(courses.slug, courseSlug), eq(modules.slug, moduleSlug), eq(lessons.slug, lessonSlug))
    )
    .limit(1);
  return result?.lesson ?? null;
}

function getScope(request: NextRequest) {
  return {
    courseSlug: request.nextUrl.searchParams.get('courseSlug'),
    moduleSlug: request.nextUrl.searchParams.get('moduleSlug'),
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await authServer.requireTeacher();
    const { lessonSlug } = await params;
    const { courseSlug, moduleSlug } = getScope(request);
    const lesson = await findLesson(lessonSlug, courseSlug, moduleSlug);
    if (!lesson)
      return sendApiError(404, 'LESSON_NOT_FOUND', 'Lesson not found in this course and module');

    const sanityLesson = await sanityServerClient.fetch(
      `*[_type == "lesson" && _id == $sanityDocumentId][0]{
        _id, _type, title, moduleId,
        contentBlocks[]{
          ...,
          _type == "imageBlock" => { ..., image{ ..., asset->{ _id, _type, url, metadata } } },
          _type == "fileBlock" => { ..., file{ ..., asset->{ _id, _type, url, mimeType, size, originalFilename } } },
          _type == "videoBlock" => { ..., video{ ..., asset->{ _id, _type, assetId, playbackId, status } } }
        }
      }`,
      { sanityDocumentId: lesson.sanityDocumentId }
    );
    if (!sanityLesson)
      return sendApiError(
        404,
        'SANITY_DOCUMENT_NOT_FOUND',
        'The associated Sanity lesson document could not be found'
      );
    return NextResponse.json({ lesson, content: sanityLesson });
  } catch (error) {
    return handleRouteError(error, 'GET /api/teacher/lessons/[lessonSlug]');
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await authServer.requireTeacher();
    const { lessonSlug } = await params;
    const { courseSlug, moduleSlug } = getScope(request);
    const existingLesson = await findLesson(lessonSlug, courseSlug, moduleSlug);
    if (!existingLesson)
      return sendApiError(404, 'LESSON_NOT_FOUND', 'Lesson not found in this course and module');

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return sendApiError(400, 'INVALID_BODY', 'A valid request body is required');
    const data = body as Record<string, unknown>;
    const dbUpdates: {
      title?: string;
      description?: string | null;
      slug?: string;
      order?: number;
    } = {};
    const sanityUpdates: Record<string, unknown> = {};

    if (Object.hasOwn(data, 'title')) {
      if (typeof data.title !== 'string' || !data.title.trim())
        return sendApiError(400, 'INVALID_TITLE', 'Lesson title must be a non-empty string');
      dbUpdates.title = data.title.trim();
      sanityUpdates.title = data.title.trim();
    }
    if (Object.hasOwn(data, 'description')) {
      if (data.description !== null && typeof data.description !== 'string')
        return sendApiError(400, 'INVALID_DESCRIPTION', 'Description must be a string or null');
      dbUpdates.description =
        typeof data.description === 'string' ? data.description.trim() || null : null;
    }
    if (Object.hasOwn(data, 'slug') || dbUpdates.title !== undefined) {
      const slugSource = Object.hasOwn(data, 'slug') ? data.slug : dbUpdates.title;
      if (typeof slugSource !== 'string')
        return sendApiError(400, 'INVALID_SLUG', 'Slug must be a string');
      const baseSlug = createSlug(slugSource);
      if (!baseSlug) return sendApiError(400, 'INVALID_SLUG', 'A valid slug is required');
      const others = await db
        .select({ slug: lessons.slug })
        .from(lessons)
        .where(
          and(eq(lessons.moduleId, existingLesson.moduleId), ne(lessons.id, existingLesson.id))
        );
      dbUpdates.slug = createUniqueSlug(
        baseSlug,
        others.map((item) => item.slug)
      );
    }
    if (Object.hasOwn(data, 'order')) {
      if (typeof data.order !== 'number' || !Number.isInteger(data.order) || data.order < 0)
        return sendApiError(400, 'INVALID_ORDER', 'Order must be a non-negative integer');
      dbUpdates.order = data.order;
    }
    if (Object.hasOwn(data, 'contentBlocks')) {
      if (!Array.isArray(data.contentBlocks))
        return sendApiError(400, 'INVALID_CONTENT_BLOCKS', 'Content blocks must be an array');
      sanityUpdates.contentBlocks = data.contentBlocks;
    }

    if (Object.keys(sanityUpdates).length)
      await sanityWriteClient.patch(existingLesson.sanityDocumentId).set(sanityUpdates).commit();
    let updatedLesson = existingLesson;
    if (Object.keys(dbUpdates).length) {
      const [updated] = await db
        .update(lessons)
        .set(dbUpdates)
        .where(eq(lessons.id, existingLesson.id))
        .returning();
      updatedLesson = updated;
    }
    return NextResponse.json({
      lesson: updatedLesson,
      updatedSanity: Object.keys(sanityUpdates).length > 0,
    });
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/teacher/lessons/[lessonSlug]');
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await authServer.requireTeacher();
    const { lessonSlug } = await params;
    const { courseSlug, moduleSlug } = getScope(request);
    const lesson = await findLesson(lessonSlug, courseSlug, moduleSlug);
    if (!lesson)
      return sendApiError(404, 'LESSON_NOT_FOUND', 'Lesson not found in this course and module');
    const sanityDocument = await sanityServerClient.fetch<string | null>(
      '*[_id == $documentId][0]._id',
      { documentId: lesson.sanityDocumentId }
    );
    if (sanityDocument) await sanityWriteClient.delete(lesson.sanityDocumentId);
    await db.delete(lessons).where(eq(lessons.id, lesson.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/teacher/lessons/[lessonSlug]');
  }
}
