import { NextResponse } from 'next/server';
import Mux from '@mux/mux-node';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { lessons as lessonsTable } from '@/lib/db/schema';
import { sanityServerClient } from '@/lib/sanity/server-client';

/**
 * Learner Thumbnail Token API
 *
 * Generates a signed Mux thumbnail URL for a lesson video.
 *
 * This endpoint:
 * 1. Authenticates the learner.
 * 2. Reads and validates the lesson ID from the query string.
 * 3. Retrieves the lesson's Sanity document reference.
 * 4. Resolves the video's Mux playback ID from Sanity.
 * 5. Signs the thumbnail request and returns its URL.
 */
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
  jwtPrivateKey: process.env.MUX_SIGNING_KEY_PRIVATE,
});

export async function GET(request: Request) {
  try {
    // 1. Authenticate the learner before generating a signed media URL.
    const user = await authServer.requireLearner();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'UNAUTHORIZED');
    }

    // 2. Read and validate the lesson ID from the query string.
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');

    if (!lessonId) {
      return sendApiError(400, 'BAD_REQUEST', 'Missing lessonId');
    }

    // 3. Retrieve the lesson's Sanity document reference from the database.
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

    // 4. Resolve the Mux playback ID from the linked Sanity lesson document.
    const sanityLesson = await sanityServerClient.fetch(
      `*[_type == "lesson" && _id == $sanityDocumentId][0]{
        "playbackId": videoContent.asset->playbackId
      }`,
      { sanityDocumentId: lesson.sanityDocumentId }
    );

    const playbackId = sanityLesson?.playbackId;

    if (!playbackId) {
      return sendApiError(404, 'NOT_FOUND', 'Lesson video not configured');
    }

    // 5. Sign the thumbnail request using the parameters included in its URL.
    const thumbnailToken = await mux.jwt.signPlaybackId(playbackId, {
      type: 'thumbnail',
      params: {
        time: '5',
        width: '1280',
        height: '720',
      },
    });

    const thumbnailUrl =
      `https://image.mux.com/${playbackId}/thumbnail.jpg` +
      `?time=5&width=1280&height=720&token=${encodeURIComponent(thumbnailToken)}`;

    return NextResponse.json({ thumbnailUrl });
  } catch (error) {
    return handleRouteError(error, 'Error generating learner video thumbnail');
  }
}
