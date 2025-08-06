import { NextResponse } from 'next/server'
import { authServer } from '@/lib/auth'
import { db } from '@/lib/db'
import { events, eventJudges } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  try {
    // Verify authentication and get judge info
    const user = await authServer.requireAuth()
    const userId = user.id

    // Get currently active event only
    const activeEvent = await db.select({
      id: events.id,
      name: events.name,
      description: events.description,
      status: events.status
    })
    .from(events)
    .where(eq(events.status, 'active'))
    .limit(1)

    if (!activeEvent.length) {
      return NextResponse.json({ event: null })
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

    return NextResponse.json({ event: activeEvent[0] })
  } catch (error) {
    console.error('Error fetching active event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}