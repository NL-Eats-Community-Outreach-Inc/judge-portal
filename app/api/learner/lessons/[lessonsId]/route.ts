import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { lessons as lessonsTable } from '@/lib/db/schema';
import { sanityClient } from '@/lib/sanity/client';

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

    const sanityLesson = await sanityClient.fetch(
      `
        *[_type == "lesson" && _id == $sanityDocumentId][0]{
          _id,
          title,
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
    });
  } catch (error) {
    return handleRouteError(error, 'Error fetching learner lesson');
  }
}
