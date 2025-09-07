import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { scores, teams, criteria, users, events, eventJudges } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    // Get all scores with team, criterion, and judge info including award types and categories
    // Only include scores from judges assigned to the event
    const baseScoresQuery = db
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
      );

    const allScores = eventId
      ? await baseScoresQuery
          .where(eq(teams.eventId, eventId))
          .orderBy(teams.presentationOrder, criteria.displayOrder)
      : await baseScoresQuery.orderBy(teams.presentationOrder, criteria.displayOrder);

    // Calculate team totals using proper judge-level aggregation with weighted scores
    // Filter scores by team award type vs criteria category and normalize weights for "both" teams
    const baseTeamTotalsQuery = sql`
      WITH team_weights AS (
        SELECT 
          teams.id as team_id,
          teams.award_type,
          SUM(criteria.weight) as total_weight_for_team
        FROM teams
        LEFT JOIN criteria ON criteria.event_id = teams.event_id
        WHERE ${eventId ? sql`teams.event_id = ${eventId}` : sql`1=1`}
          AND (
            (teams.award_type = 'technical' AND criteria.category = 'technical') OR
            (teams.award_type = 'business' AND criteria.category = 'business') OR
            (teams.award_type = 'both')
          )
        GROUP BY teams.id, teams.award_type
      ),
      judge_totals AS (
        SELECT 
          teams.id as "teamId",
          teams.name as "teamName",
          teams.presentation_order as "presentationOrder",
          teams.award_type as "awardType",
          scores.judge_id as "judgeId",
          users.email as "judgeEmail",
          SUM(scores.score::numeric) as judge_total,
          SUM(
            scores.score::numeric * 
            (criteria.weight::numeric / COALESCE(tw.total_weight_for_team::numeric, 100.0))
          ) as judge_weighted_total,
          COUNT(scores.score) as criteria_scored
        FROM teams
        LEFT JOIN scores ON scores.team_id = teams.id
        LEFT JOIN users ON scores.judge_id = users.id
        LEFT JOIN criteria ON scores.criterion_id = criteria.id
        LEFT JOIN team_weights tw ON tw.team_id = teams.id
        LEFT JOIN event_judges ej ON ej.judge_id = users.id AND ej.event_id = teams.event_id
        WHERE ${eventId ? sql`teams.event_id = ${eventId}` : sql`1=1`}
          AND (
            (teams.award_type = 'technical' AND criteria.category = 'technical') OR
            (teams.award_type = 'business' AND criteria.category = 'business') OR
            (teams.award_type = 'both')
          )
          AND ej.judge_id IS NOT NULL
        GROUP BY teams.id, teams.name, teams.presentation_order, teams.award_type, scores.judge_id, users.email
      ),
      team_calculations AS (
        SELECT 
          "teamId",
          "teamName",
          "presentationOrder",
          "awardType",
          COALESCE(SUM(judge_total), 0) as total_score,
          COALESCE(AVG(judge_total), 0) as average_score,
          COALESCE(AVG(judge_weighted_total), 0) as weighted_score,
          COUNT("judgeId") as judge_count,
          SUM(criteria_scored) as total_scores
        FROM judge_totals
        WHERE judge_total IS NOT NULL
        GROUP BY "teamId", "teamName", "presentationOrder", "awardType"
      )
      SELECT 
        "teamId",
        "teamName", 
        "presentationOrder",
        "awardType",
        ROUND(total_score::numeric, 2) as "totalScore",
        ROUND(average_score::numeric, 2) as "averageScore", 
        ROUND(weighted_score::numeric, 2) as "weightedScore",
        total_scores as "totalScores",
        judge_count as "judgeCount"
      FROM team_calculations
      ORDER BY total_score DESC
    `;

    const teamTotals = await db.execute(baseTeamTotalsQuery);

    // Get criteria averages per team (filtered by team award type vs criteria category)
    // Only include scores from assigned judges
    const baseCriteriaAveragesQuery = db
      .select({
        teamId: scores.teamId,
        teamName: teams.name,
        criterionId: scores.criterionId,
        criterionName: criteria.name,
        averageScore: sql<number>`AVG(${scores.score}::numeric)`,
        judgeCount: sql<number>`COUNT(${scores.score})`,
      })
      .from(scores)
      .innerJoin(teams, eq(scores.teamId, teams.id))
      .innerJoin(criteria, eq(scores.criterionId, criteria.id))
      .innerJoin(users, eq(scores.judgeId, users.id))
      .innerJoin(
        eventJudges,
        sql`${eventJudges.judgeId} = ${users.id} AND ${eventJudges.eventId} = ${teams.eventId}`
      );

    const criteriaAverages = eventId
      ? await baseCriteriaAveragesQuery
          .where(
            sql`${teams.eventId} = ${eventId} AND (
              (${teams.awardType} = 'technical' AND ${criteria.category} = 'technical') OR
              (${teams.awardType} = 'business' AND ${criteria.category} = 'business') OR
              (${teams.awardType} = 'both')
            )`
          )
          .groupBy(
            scores.teamId,
            teams.name,
            scores.criterionId,
            criteria.name,
            teams.presentationOrder,
            criteria.displayOrder
          )
          .orderBy(teams.presentationOrder, criteria.displayOrder)
      : await baseCriteriaAveragesQuery
          .where(
            sql`(
              (${teams.awardType} = 'technical' AND ${criteria.category} = 'technical') OR
              (${teams.awardType} = 'business' AND ${criteria.category} = 'business') OR
              (${teams.awardType} = 'both')
            )`
          )
          .groupBy(
            scores.teamId,
            teams.name,
            scores.criterionId,
            criteria.name,
            teams.presentationOrder,
            criteria.displayOrder
          )
          .orderBy(teams.presentationOrder, criteria.displayOrder);

    // Get event information and all criteria if eventId is provided
    let eventInfo = null;
    let criteriaCount = 0;
    let allCriteria: Array<{
      id: string;
      name: string;
      category: 'technical' | 'business';
      displayOrder: number;
    }> = [];
    if (eventId) {
      const eventResult = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
      eventInfo = eventResult[0] || null;

      // Get all criteria for this event (not just scored ones)
      const allCriteriaResult = await db
        .select({
          id: criteria.id,
          name: criteria.name,
          category: criteria.category,
          displayOrder: criteria.displayOrder,
        })
        .from(criteria)
        .where(eq(criteria.eventId, eventId))
        .orderBy(criteria.displayOrder);

      allCriteria = allCriteriaResult.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category as 'technical' | 'business',
        displayOrder: c.displayOrder,
      }));
      criteriaCount = allCriteria.length;
    }

    return NextResponse.json({
      event: eventInfo,
      criteriaCount,
      allCriteria,
      scores: allScores,
      teamTotals: (teamTotals as Array<Record<string, unknown>>).map(
        (total: Record<string, unknown>) => ({
          teamId: total.teamId,
          teamName: total.teamName,
          presentationOrder: Number(total.presentationOrder),
          awardType: total.awardType as 'technical' | 'business' | 'both',
          totalScore: Number(total.totalScore),
          averageScore: Number(total.averageScore),
          weightedScore: Number(total.weightedScore),
          totalScores: Number(total.totalScores),
          judgeCount: Number(total.judgeCount),
        })
      ),
      criteriaAverages: criteriaAverages.map((avg) => ({
        ...avg,
        averageScore: parseFloat(Number(avg.averageScore).toFixed(2)),
      })),
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
