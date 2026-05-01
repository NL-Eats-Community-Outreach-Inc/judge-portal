import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { RecommendationResult } from './recommendation-orchestrator';

/*
    Define important threshold for model decisions
*/
const RULES_CONFIG = {
  INACTIVITY_THRESHOLD_DAYS: 14,
  HIGH_PROGRESS_THRESHOLD: 80,
  DEFAULT_FALLBACK_ITEM_ID: 'BIO-340',
};

/**
    Evaluates the learner's state against deterministic rules (IC-25)
 */
export async function generateRuleBasedRecommendation(
  learnworldsUserId: string
): Promise<RecommendationResult> {
  const [latestEvent] = await db
    .select()
    .from(schema.learnerItemEvents)
    .where(eq(schema.learnerItemEvents.learnworldsUserId, learnworldsUserId))
    .orderBy(desc(schema.learnerItemEvents.eventTimestamp))
    .limit(1);

  const activeProgress = await db
    .select()
    .from(schema.learnerProgress)
    .where(eq(schema.learnerProgress.learnworldsUserId, learnworldsUserId))
    .orderBy(desc(schema.learnerProgress.progressPercentage));

  const completedCourses = activeProgress.filter((p) => p.completionStatus === 'completed');
  const inProgressCourses = activeProgress.filter((p) => p.completionStatus === 'in_progress');

  let recommendation: RecommendationResult | null = null;

  /*
    Case: User has activity history, at least one course in progress, and has not logged in, in the last THRESHOLD number of days 
    Result: If true it recommends the last course the user was interacting with 
  */
  if (latestEvent && inProgressCourses.length > 0) {
    const daysSinceLastEvent =
      (new Date().getTime() - new Date(latestEvent.eventTimestamp).getTime()) / (1000 * 3600 * 24);

    const isEventItemInProgress = inProgressCourses.some((c) => c.courseId === latestEvent.itemId);
    if (daysSinceLastEvent >= RULES_CONFIG.INACTIVITY_THRESHOLD_DAYS && isEventItemInProgress) {
      const [itemDetails] = await db
        .select({ title: schema.learningItems.title })
        .from(schema.learningItems)

        // learningItems must be seeded with names that are the same as from LearnWorlds
        .where(eq(schema.learningItems.itemId, latestEvent.itemId));

      if (itemDetails) {
        recommendation = {
          recommendedItemId: latestEvent.itemId,
          recommendedTitle: itemDetails.title,
          rationale: 'It has been a while! Pick up right where you left off.',
          ruleMatched: 'resume_inactivity',
          source: 'rule',
        };
      }
    }
  }

  /*
    Case: User has activity history, at least one course in progress, and has logged in, in the last THRESHOLD number of days 
          User has at least one course in progress with more than 80% progress
    Result: encourage user to complete this course 
  */
  if (!recommendation && inProgressCourses.length > 0) {
    const closestToCompletion = inProgressCourses[0];

    if (Number(closestToCompletion.progressPercentage) >= RULES_CONFIG.HIGH_PROGRESS_THRESHOLD) {
      const [itemDetails] = await db
        .select({ title: schema.learningItems.title })
        .from(schema.learningItems)
        .where(eq(schema.learningItems.itemId, closestToCompletion.courseId!));

      if (itemDetails) {
        recommendation = {
          recommendedItemId: closestToCompletion.courseId!,
          recommendedTitle: itemDetails.title,
          rationale: 'You are so close to finishing! Complete this course today.',
          ruleMatched: 'high_progress',
          source: 'rule',
        };
      }
    }
  }

  /*
    Case: user has completed at least one course and no courses in progress 
    Result: find a course whose prerequisite is one of the completed courses 
  */
  if (!recommendation && completedCourses.length > 0) {
    const completedCourseIds = completedCourses.map((c) => c.courseId!);

    const [nextItem] = await db
      .select()
      .from(schema.learningItems)
      .where(
        and(
          inArray(schema.learningItems.prerequisiteItemId, completedCourseIds),
          eq(schema.learningItems.isActive, true)
        )
      )
      .limit(1);

    if (nextItem) {
      recommendation = {
        recommendedItemId: nextItem.itemId,
        recommendedTitle: nextItem.title,
        rationale: 'Based on your recent completions, this is the logical next step.',
        ruleMatched: 'next_step_progression',
        source: 'rule',
      };
    }
  }

  /*
    Case: cold start, new user
    Result: recommends default course 
  */
  if (!recommendation) {
    const [fallbackItem] = await db
      .select()
      .from(schema.learningItems)
      .where(eq(schema.learningItems.itemId, RULES_CONFIG.DEFAULT_FALLBACK_ITEM_ID));

    if (!fallbackItem) {
      throw new Error(`Fallback item '${RULES_CONFIG.DEFAULT_FALLBACK_ITEM_ID}' not found in 
        learning_items. Check seed data.`);
    }

    recommendation = {
      recommendedItemId: fallbackItem.itemId,
      recommendedTitle: fallbackItem?.title || 'Foundations Course',
      rationale: 'A popular starting point for new learners.',
      ruleMatched: 'default_popular',
      source: 'fallback',
    };
  }

  /*
    Insert recommendation into table 
  */
  await db
    .insert(schema.learnerRecommendations)
    .values({
      learnworldsUserId,
      recommendedItemId: recommendation.recommendedItemId,
      recommendedTitle: recommendation.recommendedTitle,
      rationale: recommendation.rationale,
      ruleMatched: recommendation.ruleMatched,
      source: recommendation.source,
      score: '1.0',
    })
    .returning();

  return recommendation;
}
