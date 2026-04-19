import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { recommendationFeedback } from '@/lib/db/schema';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const { recommendationId, recommendedItemId, feedbackType, rating, comment } = body;

    console.log(recommendationId);
    console.log(recommendedItemId);
    console.log(feedbackType);
    console.log(rating);
    console.log(comment);

    if (!recommendationId || !recommendedItemId) {
      return NextResponse.json(
        { error: 'Missing required fields: recommendationId or recommendedItemId' },
        { status: 400 }
      );
    }

    const [newFeedback] = await db
      .insert(recommendationFeedback)
      .values({
        recommendationId,
        learnworldsUserId: user.id,
        recommendedItemId,
        feedbackType,
        rating,
        comment,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: newFeedback,
    });
  } catch (error) {
    console.error('Feedback Submission Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
