import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { recommendationFeedback } from '@/lib/db/schema';
import { learnerRecommendations } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';

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

    const { recommendationId, learnworldsUserId, recommendedItemId, feedbackType, rating, comment } = body;

    if (!recommendationId || !recommendedItemId || !learnworldsUserId || !feedbackType || !rating) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if(!['helpful', 'not_helpful'].includes(feedbackType)) {
      return NextResponse.json(
        { error: 'Incorrect values for feedbackType' },
        { status: 400 }
      );
    }

    if(rating <= 0 || rating > 5) {
      return NextResponse.json(
        { error: 'Out of range for rating' },
        { status: 400 }
      );
    }

    const [recommendation] = await db
          .select({
            id: learnerRecommendations.id,
            learnworldsUserId: learnerRecommendations.learnworldsUserId,
            recommendedItemId: learnerRecommendations.recommendedItemId,
            recommendedTitle: learnerRecommendations.recommendedTitle,
            rationale: learnerRecommendations.rationale,
            source: learnerRecommendations.source,
            ruleMatched: learnerRecommendations.ruleMatched,
            createdAt: learnerRecommendations.createdAt,
          })
          .from(learnerRecommendations)
          .where(
            and(
              eq(learnerRecommendations.learnworldsUserId, learnworldsUserId),
              eq(learnerRecommendations.id, recommendationId)
            )
          )
          .orderBy(desc(learnerRecommendations.createdAt))
          .limit(1);

    const [newFeedback] = await db
      .insert(recommendationFeedback)
      .values({
        recommendationId,
        learnworldsUserId,
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
