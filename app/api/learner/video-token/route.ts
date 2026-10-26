import { NextResponse } from 'next/server';
import Mux from '@mux/mux-node';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { lessons as lessonsTable } from '@/lib/db/schema';
import { sanityServerClient } from '@/lib/sanity/server-client';

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
  jwtPrivateKey: process.env.MUX_SIGNING_KEY_PRIVATE,
});

/**
 * GET /api/learner/video-token?lessonId=[lessonId]
 *
 * Generates a signed playback token for a lesson's Mux video.
 *
 * This endpoint:
 * 1. Checks that the requesting user is authenticated.
 * 2. Reads the lesson ID from the URL query parameters.
 * 3. Retrieves the lesson's Sanity document ID from the database.
 * 4. Fetches the video's Mux playback ID from Sanity.
 * 5. Generates a signed JWT for video playback.
 * 6. Returns the token and playback ID as JSON.
 *
 * The frontend uses this response to authenticate video playback
 * in the learner lesson view.
 */

export async function GET(request: Request) {
  try {
    // 1.
    const user = await authServer.requireLearner();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'UNAUTHORIZED');
    }

    // 2.
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');

    if (!lessonId) {
      return sendApiError(400, 'BAD_REQUEST', 'Missing lessonId');
    }

    // 3.
    const [lesson] = await db
      .select({
        sanityDocumentId: lessonsTable.sanityDocumentId,
      })
      .from(lessonsTable)
      .where(eq(lessonsTable.id, lessonId))
      .limit(1);

    if (!lesson) {
      return sendApiError(404, 'NOT_FOUND', 'Lesson not found');
    }

    if (!lesson.sanityDocumentId) {
      return sendApiError(404, 'NOT_FOUND', 'Lesson content not configured');
    }

    // 4.
    const sanityLesson = await sanityServerClient.fetch(
      `
        *[_type == "lesson" && _id == $sanityDocumentId][0]{
          "playbackId": videoContent.asset->playbackId
        }
      `,
      {
        sanityDocumentId: lesson.sanityDocumentId,
      }
    );

    const playbackId = sanityLesson?.playbackId;

    if (!playbackId) {
      return sendApiError(404, 'NOT_FOUND', 'Lesson video not configured');
    }

    // 5.
    const token = await mux.jwt.signPlaybackId(playbackId, {
      type: 'video',
    });

    // 6.
    return NextResponse.json({
      token,
      playbackId,
    });
  } catch (error) {
    return handleRouteError(error, 'Error generating learner video token');
  }
}
