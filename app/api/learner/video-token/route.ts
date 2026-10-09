import { NextResponse } from 'next/server';
import Mux from '@mux/mux-node';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { lessons as lessonsTable } from '@/lib/db/schema';
import { sanityClient } from '@/lib/sanity/client';

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
  jwtPrivateKey: process.env.MUX_SIGNING_KEY_PRIVATE,
});

export async function GET(request: Request) {
  try {
    const user = await authServer.getUser();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'Unauthorized');
    }

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');

    if (!lessonId) {
      return sendApiError(400, 'BAD_REQUEST', 'Missing lessonId');
    }

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

    const sanityLesson = await sanityClient.fetch(
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

    const token = await mux.jwt.signPlaybackId(playbackId, {
      type: 'video',
    });

    return NextResponse.json({
      token,
      playbackId,
    });
  } catch (error) {
    return handleRouteError(error, 'Error generating learner video token');
  }
}
