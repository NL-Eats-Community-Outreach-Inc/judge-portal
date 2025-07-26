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

    // Calculate team totals and averages
    const baseTeamTotalsQuery = db
      .select({
        teamId: teams.id,
        teamName: teams.name,
        presentationOrder: teams.presentationOrder,
        totalScore: sql<number>`COALESCE(SUM(${scores.score}), 0)`,
        averageScore: sql<number>`CASE WHEN COUNT(${scores.score}) > 0 THEN ROUND(AVG(${scores.score}::numeric), 2) ELSE 0 END`,
        totalScores: sql<number>`COUNT(${scores.score})`,
        judgeCount: sql<number>`COUNT(DISTINCT ${scores.judgeId})`
      })
      .from(teams)
      .leftJoin(scores, eq(scores.teamId, teams.id))

    const teamTotals = eventId 
      ? await baseTeamTotalsQuery
          .where(eq(teams.eventId, eventId))
          .groupBy(teams.id, teams.name, teams.presentationOrder)
          .orderBy(sql<number>`COALESCE(SUM(${scores.score}), 0) DESC`)
      : await baseTeamTotalsQuery
          .groupBy(teams.id, teams.name, teams.presentationOrder)
          .orderBy(sql<number>`COALESCE(SUM(${scores.score}), 0) DESC`)

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
      teamTotals: teamTotals.map(total => ({
        ...total,
        totalScore: Number(total.totalScore),
        averageScore: Number(total.averageScore)
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