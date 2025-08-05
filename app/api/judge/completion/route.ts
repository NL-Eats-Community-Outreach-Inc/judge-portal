import { NextResponse } from 'next/server'
import { authServer } from '@/lib/auth'
import { db } from '@/lib/db'
import { teams, criteria, scores, events } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'

export async function GET() {
  try {
    // Verify authentication
    const user = await authServer.requireAuth()

    // Get currently active event only
    const activeEvent = await db.select()
      .from(events)
      .where(eq(events.status, 'active'))
      .limit(1)

    if (!activeEvent.length) {
      return NextResponse.json({ completion: [] })
    }

    const eventId = activeEvent[0].id

    // Get all teams for the current event with their award types
    const eventTeams = await db.select({ 
      id: teams.id, 
      awardType: teams.awardType 
    })
      .from(teams)
      .where(eq(teams.eventId, eventId))

    // Calculate completion status for each team
    const completion = await Promise.all(
      eventTeams.map(async (team) => {
        // Get criteria count based on team's award type
        let criteriaFilter
        if (team.awardType === 'technical') {
          criteriaFilter = and(
            eq(criteria.eventId, eventId),
            eq(criteria.category, 'technical')
          )
        } else if (team.awardType === 'business') {
          criteriaFilter = and(
            eq(criteria.eventId, eventId),
            eq(criteria.category, 'business')
          )
        } else {
          // 'both' - show all criteria
          criteriaFilter = eq(criteria.eventId, eventId)
        }

        // Get the filtered criteria count for this team
        const teamCriteria = await db.select({ count: count() })
          .from(criteria)
          .where(criteriaFilter)

        // Count how many scores this judge has submitted for this team in the active event
        const judgeScores = await db.select({ count: count() })
          .from(scores)
          .where(
            and(
              eq(scores.judgeId, user.id),
              eq(scores.teamId, team.id),
              eq(scores.eventId, eventId)
            )
          )

        const completedCriteria = judgeScores[0]?.count || 0
        const totalCriteria = teamCriteria[0]?.count || 0

        const completed = completedCriteria === totalCriteria && totalCriteria > 0
        const partial = completedCriteria > 0 && completedCriteria < totalCriteria

        return {
          teamId: team.id,
          completed,
          partial
        }
      })
    )

    return NextResponse.json({ completion })
  } catch (error) {
    console.error('Error fetching completion status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch completion status' },
      { status: 500 }
    )
  }
}