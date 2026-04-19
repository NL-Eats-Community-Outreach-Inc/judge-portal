import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // Use your server-side Supabase helper
import { db } from '@/lib/db';
import { learnerRecommendations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const supabase = await createClient(); // Get the server-side client
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    .where(eq(learnerRecommendations.learnworldsUserId, user.id))
    .orderBy(desc(learnerRecommendations.createdAt))
    .limit(1);

    if (!recommendation) {
      // Fallback
      return NextResponse.json({
        id: '1d8ca39d-4318-4365-8fe0-293e790495eb',
        learner_id: user.id,
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