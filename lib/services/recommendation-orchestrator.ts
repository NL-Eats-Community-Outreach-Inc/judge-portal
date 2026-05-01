import { eq, desc, count } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { generateRuleBasedRecommendation } from './rule-based-recommendation-model';
import { generateMLRecommendation } from './ml-based-recommendation-model';

/*
    Define orchestrator thresholds
        - Freshness policy in hours (IC-26)
        - Minimum number of events required to qualify for ML inference
*/
const ORCHESTRATOR_CONFIG = {
  ML_READY_EVENT_THRESHOLD: 5,
  FRESHNESS_HOURS_THRESHOLD: 24,
};

/*
    Create type that is returned containing the recommendation
*/
export type RecommendationResult = {
  recommendedItemId: string;
  recommendedTitle: string;
  rationale: string;
  ruleMatched: string;
  source: 'rule' | 'fallback';
};

export type OrchestratorResult = Omit<RecommendationResult, 'source'> & {
  source: 'rule' | 'fallback' | 'ml';
  model_version?: string;
};

/*
    Recommendation Orchestrator 
        Calls the correct recommendation based on current information for learner
 */
export async function getRecommendation(learnworldsUserId: string): Promise<OrchestratorResult> {
  // Freshness Check (IC-26): if there is a recommendation within the last 24 hours, reuse that rec
  const [latestRec] = await db
    .select()
    .from(schema.learnerRecommendations)
    .where(eq(schema.learnerRecommendations.learnworldsUserId, learnworldsUserId))
    .orderBy(desc(schema.learnerRecommendations.createdAt))
    .limit(1);

  if (latestRec) {
    const hoursSinceRec =
      (new Date().getTime() - new Date(latestRec.createdAt).getTime()) / (1000 * 3600);

    if (hoursSinceRec < ORCHESTRATOR_CONFIG.FRESHNESS_HOURS_THRESHOLD) {
      return {
        recommendedItemId: latestRec.recommendedItemId,
        recommendedTitle: latestRec.recommendedTitle,
        rationale: latestRec.rationale,
        ruleMatched: latestRec.ruleMatched,
        source: latestRec.source as 'rule' | 'fallback' | 'ml',
        model_version: latestRec.modelVersion,
      };
    }
  }

  // Determine ML Readiness via learner_item_events count
  const [eventCountResult] = await db
    .select({ value: count() })
    .from(schema.learnerItemEvents)
    .where(eq(schema.learnerItemEvents.learnworldsUserId, learnworldsUserId));

  const hasEnoughData = eventCountResult.value >= ORCHESTRATOR_CONFIG.ML_READY_EVENT_THRESHOLD;

  // ML Path with Rule-Based Fallback
  if (hasEnoughData) {
    try {
      const mlResult = await generateMLRecommendation(learnworldsUserId);

      if (mlResult) {
        // Persist the ML recommendation
        await persistRecommendation(learnworldsUserId, mlResult);
        return mlResult;
      }
    } catch (error) {
      // If ML throws an error, drop down to the rule-based approach
      console.warn(
        `ML Inference failed for user ${learnworldsUserId}. Safely falling back to rules.`,
        error
      );
    }
  }

  // Rule-Based Path (Cold Start / Low Data / ML Fallback) handles new user, low user data, and defaults
  const ruleResult = await generateRuleBasedRecommendation(learnworldsUserId);

  return { ...ruleResult, model_version: undefined };
}

/**
 * Helper to persist ML recommendations
 */
async function persistRecommendation(userId: string, rec: OrchestratorResult) {
  await db.insert(schema.learnerRecommendations).values({
    learnworldsUserId: userId,
    recommendedItemId: rec.recommendedItemId,
    recommendedTitle: rec.recommendedTitle,
    rationale: rec.rationale,
    ruleMatched: latestRec.ruleMatched ?? '',
    source: rec.source,
    modelVersion: rec.model_version,
    score: '1.0',
  });
}
