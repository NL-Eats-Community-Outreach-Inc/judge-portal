import { NextResponse } from 'next/server'
import { authServer } from '@/lib/auth'
import { db } from '@/lib/db'
import { teams, events, eventJudges } from '@/lib/db/schema'
import { eq, asc, and } from 'drizzle-orm'

export async function GET() {
  try {
    // Verify authentication and get judge info
    const user = await authServer.requireAuth()
    const userId = user.id

    // Get currently active event only
    const activeEvent = await db.select()
      .from(events)
      .where(eq(events.status, 'active'))
      .limit(1)

    if (!activeEvent.length) {
      return NextResponse.json({ teams: [] })
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

    // Get all teams for the active event, ordered by presentation_order
    const eventTeams = await db.select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      presentationOrder: teams.presentationOrder
    })
    .from(teams)
    .where(eq(teams.eventId, activeEvent[0].id))
    .orderBy(asc(teams.presentationOrder))

    return NextResponse.json({ teams: eventTeams })
  } catch (error) {
    console.error('Error fetching teams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}