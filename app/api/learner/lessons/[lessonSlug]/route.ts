import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, and, gt, asc } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import {
  lessons as lessonsTable,
  modules as modulesTable,
  courses as coursesTable,
} from '@/lib/db/schema';
import { sanityServerClient } from '@/lib/sanity/server-client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonSlug: string }> }
) {
  try {
    // 1. Authenticate the learner.
    const user = await authServer.requireLearner();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'UNAUTHORIZED');
    }

    // 2. Get both slugs: the lesson slug from the route
    // and the course slug from the query string.
    const { lessonSlug } = await params;
    const { searchParams } = new URL(request.url);
    const courseSlug = searchParams.get('courseSlug');

    if (!courseSlug) {
      return sendApiError(400, 'BAD_REQUEST', 'Missing courseSlug parameter');
    }

    // 3. Find the lesson ONLY within the requested course.
    const [result] = await db
      .select({
        lesson: lessonsTable,
      })
      .from(lessonsTable)
      .innerJoin(modulesTable, eq(lessonsTable.moduleId, modulesTable.id))
      .innerJoin(coursesTable, eq(modulesTable.courseId, coursesTable.id))
      .where(and(eq(coursesTable.slug, courseSlug), eq(lessonsTable.slug, lessonSlug)))
      .limit(1);

    const lesson = result?.lesson;

    if (!lesson) {
      return sendApiError(404, 'NOT_FOUND', 'Lesson not found in this course');
    }

    // 4. Verify that Sanity content is configured.
    if (!lesson.sanityDocumentId) {
      return sendApiError(404, 'NOT_FOUND', 'Lesson content not configured');
    }

    // Get the lesson's module.
    const [module] = await db
      .select()
      .from(modulesTable)
      .where(eq(modulesTable.id, lesson.moduleId))
      .limit(1);

    // 5. Find the next lesson in the same module.
    const [nextLesson] = await db
      .select({
        id: lessonsTable.id,
        title: lessonsTable.title,
        slug: lessonsTable.slug,
        order: lessonsTable.order,
        moduleId: lessonsTable.moduleId,
      })
      .from(lessonsTable)
      .where(and(eq(lessonsTable.moduleId, lesson.moduleId), gt(lessonsTable.order, lesson.order)))
      .orderBy(asc(lessonsTable.order))
      .limit(1);

    // 6. Fetch lesson content from Sanity.
    const sanityLesson = await sanityServerClient.fetch(
      `
        *[_type == "lesson" && _id == $sanityDocumentId][0]{
          _id,
          title,
          lessonFormat,
          content,
          videoContent{
            _type,
            asset->{
              _id,
              _type,
              assetId,
              playbackId,
              status
            }
          }
        }
      `,
      {
        sanityDocumentId: lesson.sanityDocumentId,
      }
    );

    if (!sanityLesson) {
      return sendApiError(404, 'NOT_FOUND', 'Lesson content not found');
    }

    // 7. Return lesson content and navigation metadata.
    return NextResponse.json({
      lesson,
      content: sanityLesson,
      navigation: {
        courseId: module?.courseId ?? null,
        nextLessonId: nextLesson?.id ?? null,
        nextLessonTitle: nextLesson?.title ?? null,
        nextLessonSlug: nextLesson?.slug ?? null,
      },
    });
  } catch (error) {
    return handleRouteError(error, 'Error fetching learner lesson');
  }
}
