import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { learnerRecommendations, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateRuleBasedRecommendation } from '@/lib/services/recommendation-model';
import * as schema from '@/lib/db/schema';

export async function GET(
  request: Request,
  { params }: { params: { learner_id: string } }
) {
  try {
    const { learner_id } = await params;

    if (!learner_id || learner_id === 'undefined') {
      return NextResponse.json(
        { error: 'Missing or invalid learner_id' }, 
        { status: 400 }
      );
    }

    /*const [learnerExists] = await db
      .select()
      .from(schema.learnerProgress)
      .where(eq(schema.learnerProgress.learnworldsUserId, learner_id))
      .limit(1);

    if (!learnerExists) {
      return NextResponse.json(
        { error: 'Learner not found' }, 
        { status: 404 }
      );
    }*/

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
      .where(eq(learnerRecommendations.learnworldsUserId, learner_id))
      .orderBy(desc(learnerRecommendations.createdAt))
      .limit(1);

    let isOld = false;
    if (recommendation && recommendation.createdAt) {
      const recDate = new Date(recommendation.createdAt).getTime();
      const now = new Date().getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (now - recDate > twentyFourHours) {
        isOld = true;
      }
    }

    if (recommendation && !isOld) {
      return NextResponse.json({
        id: recommendation.id,
        learner_id: recommendation.learnworldsUserId,
        recommended_item_id: recommendation.recommendedItemId,
        recommended_title: recommendation.recommendedTitle,
        rationale: recommendation.rationale,
        source: recommendation.source,
        rule_matched: recommendation.ruleMatched,
      });
    }

    const ruleBasedRec = await generateRuleBasedRecommendation(learner_id);

    return NextResponse.json({
      id: null,
      learner_id: learner_id,
      recommended_item_id: ruleBasedRec.recommendedItemId,
      recommended_title: ruleBasedRec.recommendedTitle,
      rationale: ruleBasedRec.rationale,
      source: ruleBasedRec.source,
      rule_matched: ruleBasedRec.ruleMatched
    });

  } catch (error) {
    console.error('Database Fetch Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}
