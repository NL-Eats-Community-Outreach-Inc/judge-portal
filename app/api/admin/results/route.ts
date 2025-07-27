import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { scores, teams, criteria, users, events } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    // Get all scores with team, criterion, and judge info
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
          presentationOrder: teams.presentationOrder
        },
        criterion: {
          id: criteria.id,
          name: criteria.name,
          displayOrder: criteria.displayOrder,
          minScore: criteria.minScore,
          maxScore: criteria.maxScore
        },
        judge: {
          id: users.id,
          email: users.email
        }
      })
      .from(scores)
      .innerJoin(teams, eq(scores.teamId, teams.id))
      .innerJoin(criteria, eq(scores.criterionId, criteria.id))
      .innerJoin(users, eq(scores.judgeId, users.id))

    const allScores = eventId 
      ? await baseScoresQuery
          .where(eq(teams.eventId, eventId))
          .orderBy(teams.presentationOrder, criteria.displayOrder)
      : await baseScoresQuery
          .orderBy(teams.presentationOrder, criteria.displayOrder)

    // Calculate team totals using proper judge-level aggregation
    const baseTeamTotalsQuery = sql`
      WITH judge_totals AS (
        SELECT 
          teams.id as "teamId",
          teams.name as "teamName",
          teams.presentation_order as "presentationOrder",
          scores.judge_id as "judgeId",
          users.email as "judgeEmail",
          SUM(scores.score::numeric) as judge_total,
          COUNT(scores.score) as criteria_scored
        FROM teams
        LEFT JOIN scores ON scores.team_id = teams.id
        LEFT JOIN users ON scores.judge_id = users.id
        ${eventId ? sql`WHERE teams.event_id = ${eventId}` : sql``}
        GROUP BY teams.id, teams.name, teams.presentation_order, scores.judge_id, users.email
      ),
      team_calculations AS (
        SELECT 
          "teamId",
          "teamName",
          "presentationOrder",
          COALESCE(SUM(judge_total), 0) as total_score,
          COALESCE(AVG(judge_total), 0) as average_score,
          COALESCE(AVG(judge_total), 0) as weighted_average_score,
          COUNT("judgeId") as judge_count,
          SUM(criteria_scored) as total_scores
        FROM judge_totals
        WHERE judge_total IS NOT NULL
        GROUP BY "teamId", "teamName", "presentationOrder"
      )
      SELECT 
        "teamId",
        "teamName", 
        "presentationOrder",
        ROUND(total_score::numeric, 2) as "totalScore",
        ROUND(average_score::numeric, 2) as "averageScore", 
        ROUND(weighted_average_score::numeric, 2) as "weightedAverageScore",
        total_scores as "totalScores",
        judge_count as "judgeCount"
      FROM team_calculations
      ORDER BY total_score DESC
    `

    const teamTotals = await db.execute(baseTeamTotalsQuery)

    // Get criteria averages per team
    const baseCriteriaAveragesQuery = db
      .select({
        teamId: scores.teamId,
        teamName: teams.name,
        criterionId: scores.criterionId,
        criterionName: criteria.name,
        averageScore: sql<number>`AVG(${scores.score}::numeric)`,
        judgeCount: sql<number>`COUNT(${scores.score})`
      })
      .from(scores)
      .innerJoin(teams, eq(scores.teamId, teams.id))
      .innerJoin(criteria, eq(scores.criterionId, criteria.id))

    const criteriaAverages = eventId 
      ? await baseCriteriaAveragesQuery
          .where(eq(teams.eventId, eventId))
          .groupBy(scores.teamId, teams.name, scores.criterionId, criteria.name, teams.presentationOrder, criteria.displayOrder)
          .orderBy(teams.presentationOrder, criteria.displayOrder)
      : await baseCriteriaAveragesQuery
          .groupBy(scores.teamId, teams.name, scores.criterionId, criteria.name, teams.presentationOrder, criteria.displayOrder)
          .orderBy(teams.presentationOrder, criteria.displayOrder)

    // Get event information and criteria count if eventId is provided
    let eventInfo = null
    let criteriaCount = 0
    if (eventId) {
      const eventResult = await db.select()
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1)
      eventInfo = eventResult[0] || null

      // Get criteria count for this event
      const criteriaCountResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(criteria)
        .where(eq(criteria.eventId, eventId))
      criteriaCount = Number(criteriaCountResult[0]?.count || 0)
    }

    return NextResponse.json({ 
      event: eventInfo,
      criteriaCount,
      scores: allScores,
      teamTotals: (teamTotals as Array<Record<string, unknown>>).map((total: Record<string, unknown>) => ({
        teamId: total.teamId,
        teamName: total.teamName,
        presentationOrder: Number(total.presentationOrder),
        totalScore: Number(total.totalScore),
        averageScore: Number(total.averageScore),
        weightedAverageScore: Number(total.weightedAverageScore),
        totalScores: Number(total.totalScores),
        judgeCount: Number(total.judgeCount)
      })),
      criteriaAverages: criteriaAverages.map(avg => ({
        ...avg,
        averageScore: parseFloat(Number(avg.averageScore).toFixed(2))
      }))
    })
  } catch (error) {
    console.error('Error fetching results:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}