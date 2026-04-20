import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { learnerRecommendations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: { learner_id: string } }
) {
  try {
    const { learner_id } = await params;

    if (!learner_id) {
      return NextResponse.json({ error: 'Missing learner_id' }, { status: 400 });
    }

    const [recommendation] = await db
      .select({
        id: learnerRecommendations.id,
        learnworldsUserId: learnerRecommendations.learnworldsUserId,
        recommendedItemId: learnerRecommendations.recommendedItemId,
        recommendedTitle: learnerRecommendations.recommendedTitle,
        rationale: learnerRecommendations.rationale,
      })
      .from(learnerRecommendations)
      .where(eq(learnerRecommendations.learnworldsUserId, learner_id))
      .orderBy(desc(learnerRecommendations.createdAt))
      .limit(1);

    if (!recommendation) {
      // Fallback
      return NextResponse.json({
        id: '1d8ca39d-4318-4365-8fe0-293e790495eb',
        learner_id: 'DEFAULT',
        recommended_item_id: 'course-default',
        recommended_title: 'Default Title',
        rationale: 'Default Rationale',
      });
    }

    return NextResponse.json({
      id: recommendation.id,
      learner_id: recommendation.learnworldsUserId,
      recommended_item_id: recommendation.recommendedItemId,
      recommended_title: recommendation.recommendedTitle,
      rationale: recommendation.rationale,
    });
  } catch (error) {
    console.error('Database Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
