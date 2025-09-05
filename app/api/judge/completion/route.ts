import { NextResponse } from 'next/server'
import { authServer } from '@/lib/auth'
import { db } from '@/lib/db'
import { teams, criteria, scores, events, eventJudges } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'

export async function GET() {
  try {
    // Verify authentication
    const user = await authServer.requireAuth()
    const userId = user.id

    // Get currently active event only
    const activeEvent = await db.select()
      .from(events)
      .where(eq(events.status, 'active'))
      .limit(1)

    if (!activeEvent.length) {
      return NextResponse.json({ completion: [] })
    }

    // Check if judge is assigned to this event
    const assignment = await db
      .select()
      .from(eventJudges)
      .where(and(
        eq(eventJudges.eventId, activeEvent[0].id),
        eq(eventJudges.judgeId, userId)
      ))
      .limit(1)

    if (!assignment.length) {
      return NextResponse.json({ 
        error: 'You are not assigned to the current active event',
        errorType: 'NOT_ASSIGNED'
      }, { status: 403 })
    }

    const eventId = activeEvent[0].id

    // Get all teams for the current event with their award types
    const eventTeams = await db.select({ 
      id: teams.id, 
      awardType: teams.awardType 
    })
      .from(teams)
      .where(eq(teams.eventId, eventId))

    // Get criteria counts by category in a single query
    const criteriaCounts = await db
      .select({
        category: criteria.category,
        count: count()
      })
      .from(criteria)
      .where(eq(criteria.eventId, eventId))
      .groupBy(criteria.category)

    // Create a map for quick lookup
    const criteriaCountMap: Record<string, number> = {}
    let totalCriteriaCount = 0
    
    for (const row of criteriaCounts) {
      criteriaCountMap[row.category || 'null'] = row.count
      totalCriteriaCount += row.count
    }

    // Get all judge scores for this event grouped by team in a single query
    const judgeScoreCounts = await db
      .select({
        teamId: scores.teamId,
        count: count()
      })
      .from(scores)
      .where(
        and(
          eq(scores.judgeId, userId),
          eq(scores.eventId, eventId)
        )
      )
      .groupBy(scores.teamId)

    // Create a map for quick lookup
    const scoreCountMap: Record<string, number> = {}
    for (const row of judgeScoreCounts) {
      scoreCountMap[row.teamId] = row.count
    }

    // Calculate completion status for each team using the pre-fetched data
    const completion = eventTeams.map((team) => {
      // Calculate total criteria for this team based on award type
      let totalCriteria: number
      if (team.awardType === 'technical') {
        totalCriteria = criteriaCountMap['technical'] || 0
      } else if (team.awardType === 'business') {
        totalCriteria = criteriaCountMap['business'] || 0
      } else {
        // 'both' - show all criteria
        totalCriteria = totalCriteriaCount
      }

      const completedCriteria = scoreCountMap[team.id] || 0

      const completed = completedCriteria === totalCriteria && totalCriteria > 0
      const partial = completedCriteria > 0 && completedCriteria < totalCriteria

      return {
        teamId: team.id,
        completed,
        partial
      }
    })

    return NextResponse.json({ completion })
  } catch (error) {
    console.error('Error fetching completion status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch completion status' },
      { status: 500 }
    )
  }
}