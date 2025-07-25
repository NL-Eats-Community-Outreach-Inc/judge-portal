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

    // Get all teams for the current event
    const eventTeams = await db.select({ id: teams.id })
      .from(teams)
      .where(eq(teams.eventId, eventId))

    // Get all criteria for the current event
    const eventCriteria = await db.select({ id: criteria.id })
      .from(criteria)
      .where(eq(criteria.eventId, eventId))

    // Calculate completion status for each team
    const completion = await Promise.all(
      eventTeams.map(async (team) => {
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
        const totalCriteria = eventCriteria.length

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