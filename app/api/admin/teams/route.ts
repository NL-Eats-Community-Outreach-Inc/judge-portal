import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { teams, events } from '@/lib/db/schema'
import { eq, max } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getUserFromSession(supabase)

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    // Build query conditions
    let query = db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        demoUrl: teams.demoUrl,
        repoUrl: teams.repoUrl,
        presentationOrder: teams.presentationOrder,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
        eventId: teams.eventId
      })
      .from(teams)

    // Filter by eventId if provided
    if (eventId) {
      query = query.where(eq(teams.eventId, eventId))
    }

    const allTeams = await query.orderBy(teams.presentationOrder)
    
    return NextResponse.json({ teams: allTeams })
  } catch (error) {
    console.error('Error fetching teams:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getUserFromSession(supabase)

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId, name, description, demoUrl, repoUrl } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    }

    // Verify event exists
    const event = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
    
    if (event.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 400 })
    }

    // Get the next presentation order by finding the max existing order
    const maxOrderResult = await db
      .select({ maxOrder: max(teams.presentationOrder) })
      .from(teams)
      .where(eq(teams.eventId, eventId))
      .limit(1)
    
    const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1

    // Create new team
    const [team] = await db
      .insert(teams)
      .values({
        eventId,
        name: name.trim(),
        description: description?.trim() || null,
        demoUrl: demoUrl?.trim() || null,
        repoUrl: repoUrl?.trim() || null,
        presentationOrder: nextOrder
      })
      .returning()

    return NextResponse.json({ team })
  } catch (error) {
    console.error('Error creating team:', error)
    
    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('duplicate key')) {
      if (error.message.includes('teams_event_id_name_key')) {
        return NextResponse.json({ error: 'A team with this name already exists' }, { status: 400 })
      }
      if (error.message.includes('teams_event_id_presentation_order_key')) {
        return NextResponse.json({ error: 'A team with this presentation order already exists' }, { status: 400 })
      }
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}