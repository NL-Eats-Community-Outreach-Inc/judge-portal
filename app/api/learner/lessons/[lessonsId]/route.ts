import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, and, gt, asc } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { lessons as lessonsTable, modules as modulesTable } from '@/lib/db/schema';
import { sanityServerClient } from '@/lib/sanity/server-client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonsId: string }> }
) {
  try {
    const user = await authServer.getUser();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'Unauthorized');
    }

    const { lessonsId } = await params;

    const [lesson] = await db
      .select()
      .from(lessonsTable)
      .where(eq(lessonsTable.id, lessonsId))
      .limit(1);

    if (!lesson) {
      return sendApiError(404, 'NOT_FOUND', 'Lesson not found');
    }

    if (!lesson.sanityDocumentId) {
      return sendApiError(404, 'NOT_FOUND', 'Lesson content not configured');
    }

    const [module] = await db
      .select()
      .from(modulesTable)
      .where(eq(modulesTable.id, lesson.moduleId))
      .limit(1);

    const [nextLesson] = await db
      .select({
        id: lessonsTable.id,
        title: lessonsTable.title,
        order: lessonsTable.order,
        moduleId: lessonsTable.moduleId,
      })
      .from(lessonsTable)
      .where(and(eq(lessonsTable.moduleId, lesson.moduleId), gt(lessonsTable.order, lesson.order)))
      .orderBy(asc(lessonsTable.order))
      .limit(1);

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

    return NextResponse.json({
      lesson,
      content: sanityLesson,
      navigation: {
        courseId: module?.courseId ?? null,
        nextLessonId: nextLesson?.id ?? null,
        nextLessonTitle: nextLesson?.title ?? null,
      },
    });
  } catch (error) {
    return handleRouteError(error, 'Error fetching learner lesson');
  }
}
