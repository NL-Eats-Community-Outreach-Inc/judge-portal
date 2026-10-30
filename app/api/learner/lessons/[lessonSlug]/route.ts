import { NextResponse } from 'next/server';
import Mux from '@mux/mux-node';
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

/**
 * Learner Lesson Detail API
 *
 * Returns lesson metadata, Sanity content, navigation, and a signed thumbnail
 * URL when the lesson includes a supported video format.
 *
 * This endpoint:
 * 1. Authenticates the learner.
 * 2. Resolves the lesson, course, and module route parameters.
 * 3. Retrieves the lesson within the specified course and module.
 * 4. Loads the next lesson and linked Sanity content.
 * 5. Generates a signed thumbnail URL when video content is available.
 * 6. Returns lesson content, navigation details, and the thumbnail URL.
 *
 * Full video playback tokens are generated separately when playback is requested.
 */
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
  jwtPrivateKey: process.env.MUX_SIGNING_KEY_PRIVATE,
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonSlug: string }> }
) {
  try {
    // 1. Authenticate the learner before returning lesson content.
    const user = await authServer.requireLearner();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'UNAUTHORIZED');
    }

    // 2. Read the lesson slug from the route and course/module slugs from the query string.
    const { lessonSlug } = await params;
    const { searchParams } = new URL(request.url);

    const courseSlug = searchParams.get('courseSlug');
    const moduleSlug = searchParams.get('moduleSlug');

    if (!courseSlug || !moduleSlug) {
      return sendApiError(400, 'BAD_REQUEST', 'Missing courseSlug or moduleSlug parameter');
    }

    // 3. Retrieve the lesson only when all three requested slugs match.
    const [result] = await db
      .select({ lesson: lessonsTable })
      .from(lessonsTable)
      .innerJoin(modulesTable, eq(lessonsTable.moduleId, modulesTable.id))
      .innerJoin(coursesTable, eq(modulesTable.courseId, coursesTable.id))
      .where(
        and(
          eq(coursesTable.slug, courseSlug),
          eq(modulesTable.slug, moduleSlug),
          eq(lessonsTable.slug, lessonSlug)
        )
      )
      .limit(1);

    const lesson = result?.lesson;

    if (!lesson) {
      return sendApiError(404, 'NOT_FOUND', 'Lesson not found in this course');
    }

    if (!lesson.sanityDocumentId) {
      return sendApiError(404, 'NOT_FOUND', 'Lesson content not configured');
    }

    const [module] = await db
      .select()
      .from(modulesTable)
      .where(eq(modulesTable.id, lesson.moduleId))
      .limit(1);

    // 4. Load the next lesson and linked Sanity content concurrently.
    const [nextLessons, sanityLesson] = await Promise.all([
      db
        .select({
          id: lessonsTable.id,
          title: lessonsTable.title,
          slug: lessonsTable.slug,
          order: lessonsTable.order,
          moduleId: lessonsTable.moduleId,
        })
        .from(lessonsTable)
        .where(
          and(eq(lessonsTable.moduleId, lesson.moduleId), gt(lessonsTable.order, lesson.order))
        )
        .orderBy(asc(lessonsTable.order))
        .limit(1),

      sanityServerClient.fetch(
        `*[_type == "lesson" && _id == $sanityDocumentId][0]{
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
        }`,
        { sanityDocumentId: lesson.sanityDocumentId }
      ),
    ]);

    const nextLesson = nextLessons[0];

    if (!sanityLesson) {
      return sendApiError(404, 'NOT_FOUND', 'Lesson content not found');
    }

    // 5. Sign only the thumbnail here. The playback token is still generated
    // separately by /api/learner/video-token when the learner clicks Play.
    let thumbnailUrl: string | null = null;
    const playbackId = sanityLesson?.videoContent?.asset?.playbackId;

    if (
      playbackId &&
      (sanityLesson.lessonFormat === 'video' || sanityLesson.lessonFormat === 'both')
    ) {
      const thumbnailToken = await mux.jwt.signPlaybackId(playbackId, {
        type: 'thumbnail',
        params: {
          time: '5',
          width: '1280',
          height: '720',
        },
      });

      thumbnailUrl =
        `https://image.mux.com/${playbackId}/thumbnail.jpg` +
        `?time=5&width=1280&height=720&token=${encodeURIComponent(thumbnailToken)}`;
    }

    // 6. Return lesson metadata, Sanity content, navigation, and the signed thumbnail URL.
    return NextResponse.json({
      lesson,
      content: sanityLesson,
      thumbnailUrl,
      navigation: {
        courseId: module?.courseId ?? null,
        nextLessonId: nextLesson?.id ?? null,
        nextLessonTitle: nextLesson?.title ?? null,
        nextLessonSlug: nextLesson?.slug ?? null,
        nextModuleSlug: module?.slug ?? null,
      },
    });
  } catch (error) {
    return handleRouteError(error, 'Error fetching learner lesson');
  }
}
