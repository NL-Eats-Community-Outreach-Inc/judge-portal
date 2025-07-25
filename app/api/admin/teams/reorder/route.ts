import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { teams } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId, teamOrders } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    if (!Array.isArray(teamOrders) || teamOrders.length === 0) {
      return NextResponse.json({ error: 'Team orders array is required' }, { status: 400 })
    }

    // Validate team orders structure
    for (const teamOrder of teamOrders) {
      if (!teamOrder.id || typeof teamOrder.presentationOrder !== 'number') {
        return NextResponse.json({ 
          error: 'Each team order must have id and presentationOrder' 
        }, { status: 400 })
      }
    }

    // Use a transaction to avoid unique constraint violations
    const updatedTeams = await db.transaction(async (tx) => {
      // First, update all affected teams to temporary high values (add 1000 to avoid conflicts)
      const tempUpdatePromises = teamOrders.map(({ id }) =>
        tx
          .update(teams)
          .set({ presentationOrder: Math.floor(1000 + Math.random() * 1000) }) // Use random high integer values to avoid any conflicts
          .where(and(eq(teams.id, id), eq(teams.eventId, eventId)))
      )
      
      await Promise.all(tempUpdatePromises)
      
      // Then update to final values
      const finalUpdatePromises = teamOrders.map(({ id, presentationOrder }) =>
        tx
          .update(teams)
          .set({ presentationOrder })
          .where(and(eq(teams.id, id), eq(teams.eventId, eventId)))
          .returning()
      )
      
      const results = await Promise.all(finalUpdatePromises)
      return results.flat()
    })
    
    // Check if all updates were successful
    if (updatedTeams.length !== teamOrders.length) {
      return NextResponse.json({ error: 'Some teams could not be updated' }, { status: 400 })
    }

    return NextResponse.json({ 
      message: 'Team orders updated successfully',
      updatedTeams 
    })
  } catch (error) {
    console.error('Error updating team orders:', error)
    
    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('duplicate key')) {
      if (error.message.includes('teams_event_id_presentation_order')) {
        return NextResponse.json({ 
          error: 'Duplicate presentation order detected' 
        }, { status: 400 })
      }
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}