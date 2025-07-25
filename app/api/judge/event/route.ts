import { NextResponse } from 'next/server'
import { authServer } from '@/lib/auth'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    // Verify authentication
    await authServer.requireAuth()

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

    return NextResponse.json({ event: activeEvent[0] })
  } catch (error) {
    console.error('Error fetching active event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}