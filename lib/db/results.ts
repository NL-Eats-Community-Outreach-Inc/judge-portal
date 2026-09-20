/**
 * The one query behind the results dashboard and both CSV exports: every score
 * row for an event from a judge who is currently assigned to it, limited to
 * the criteria that apply to the team's award type. `lib/results.ts` does the
 * math on these rows.
 */
import { db } from './index';
import { scores, teams, criteria, users, eventJudges } from './schema';
import { eq, sql } from 'drizzle-orm';
import type { ResultScore } from '@/lib/types';

export async function loadCountedScores(eventId: string): Promise<ResultScore[]> {
  const rows = await db
    .select({
      id: scores.id,
      score: scores.score,
      comment: scores.comment,
      createdAt: scores.createdAt,
      updatedAt: scores.updatedAt,
      team: {
        id: teams.id,
        name: teams.name,
        presentationOrder: teams.presentationOrder,
        awardType: teams.awardType,
      },
      criterion: {
        id: criteria.id,
        name: criteria.name,
        displayOrder: criteria.displayOrder,
        minScore: criteria.minScore,
        maxScore: criteria.maxScore,
        category: criteria.category,
      },
      judge: {
        id: users.id,
        email: users.email,
      },
    })
    .from(scores)
    .innerJoin(teams, eq(scores.teamId, teams.id))
    .innerJoin(criteria, eq(scores.criterionId, criteria.id))
    .innerJoin(users, eq(scores.judgeId, users.id))
    .innerJoin(
      eventJudges,
      sql`${eventJudges.judgeId} = ${users.id} AND ${eventJudges.eventId} = ${teams.eventId}`
    )
    .where(
      sql`${teams.eventId} = ${eventId} AND (
        ${teams.awardType} = 'both' OR ${criteria.category}::text = ${teams.awardType}::text
      )`
    )
    .orderBy(teams.presentationOrder, criteria.displayOrder);

  return rows;
}

/** Every criterion of the event with its weight, in display order. */
export async function loadEventCriteria(eventId: string) {
  return db
    .select({
      id: criteria.id,
      name: criteria.name,
      category: criteria.category,
      displayOrder: criteria.displayOrder,
      weight: criteria.weight,
      maxScore: criteria.maxScore,
    })
    .from(criteria)
    .where(eq(criteria.eventId, eventId))
    .orderBy(criteria.displayOrder);
}
