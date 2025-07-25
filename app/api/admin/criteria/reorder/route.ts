import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { criteria } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getUserFromSession(supabase)

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId, criteriaOrders } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    if (!Array.isArray(criteriaOrders) || criteriaOrders.length === 0) {
      return NextResponse.json({ error: 'Criteria orders array is required' }, { status: 400 })
    }

    // Validate criteria orders structure
    for (const criteriaOrder of criteriaOrders) {
      if (!criteriaOrder.id || typeof criteriaOrder.displayOrder !== 'number') {
        return NextResponse.json({ 
          error: 'Each criteria order must have id and displayOrder' 
        }, { status: 400 })
      }
    }

    // Use a transaction to avoid unique constraint violations
    const updatedCriteria = await db.transaction(async (tx) => {
      // First, update all affected criteria to temporary high values (add 1000 to avoid conflicts)
      const tempUpdatePromises = criteriaOrders.map(({ id }) =>
        tx
          .update(criteria)
          .set({ displayOrder: Math.floor(1000 + Math.random() * 1000) }) // Use random high integer values to avoid any conflicts
          .where(and(eq(criteria.id, id), eq(criteria.eventId, eventId)))
      )
      
      await Promise.all(tempUpdatePromises)
      
      // Then update to final values
      const finalUpdatePromises = criteriaOrders.map(({ id, displayOrder }) =>
        tx
          .update(criteria)
          .set({ displayOrder })
          .where(and(eq(criteria.id, id), eq(criteria.eventId, eventId)))
          .returning()
      )
      
      const results = await Promise.all(finalUpdatePromises)
      return results.flat()
    })
    
    // Check if all updates were successful
    if (updatedCriteria.length !== criteriaOrders.length) {
      return NextResponse.json({ error: 'Some criteria could not be updated' }, { status: 400 })
    }

    return NextResponse.json({ 
      message: 'Criteria orders updated successfully',
      updatedCriteria 
    })
  } catch (error) {
    console.error('Error updating criteria orders:', error)
    
    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('duplicate key')) {
      if (error.message.includes('criteria_event_id_display_order')) {
        return NextResponse.json({ 
          error: 'Duplicate display order detected' 
        }, { status: 400 })
      }
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}