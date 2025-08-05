import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { criteria, events } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    // Build query with conditions
    const allCriteria = eventId 
      ? await db.select().from(criteria).where(eq(criteria.eventId, eventId)).orderBy(criteria.displayOrder)
      : await db.select().from(criteria).orderBy(criteria.displayOrder)
    
    return NextResponse.json({ criteria: allCriteria })
  } catch (error) {
    console.error('Error fetching criteria:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId, name, description, minScore, maxScore, weight, category } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Criteria name is required' }, { status: 400 })
    }

    if (typeof minScore !== 'number' || typeof maxScore !== 'number') {
      return NextResponse.json({ error: 'Min and max scores must be numbers' }, { status: 400 })
    }

    if (minScore >= maxScore) {
      return NextResponse.json({ error: 'Min score must be less than max score' }, { status: 400 })
    }

    if (typeof weight !== 'number' || weight < 0 || weight > 100) {
      return NextResponse.json({ error: 'Weight must be a number between 0 and 100' }, { status: 400 })
    }

    if (!category || !['technical', 'business'].includes(category)) {
      return NextResponse.json({ error: 'Category must be either "technical" or "business"' }, { status: 400 })
    }

    // Verify event exists
    const event = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
    
    if (event.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 400 })
    }

    // Get existing criteria for weight validation and display order
    const existingCriteria = await db.select()
      .from(criteria)
      .where(eq(criteria.eventId, eventId))
    
    const nextDisplayOrder = existingCriteria.length > 0 
      ? Math.max(...existingCriteria.map(c => c.displayOrder)) + 1 
      : 1

    // Calculate current weight totals by category
    const weightTotals = existingCriteria.reduce((acc, crit) => {
      acc[crit.category] = (acc[crit.category] || 0) + crit.weight
      return acc
    }, {} as Record<string, number>)

    // Add the new criterion's weight to the appropriate category
    const newWeightTotal = (weightTotals[category] || 0) + weight

    // Validate that the category weight total won't exceed 100%
    if (newWeightTotal > 100) {
      return NextResponse.json({ 
        error: `Cannot add criterion: ${category} category weights would total ${newWeightTotal}% (maximum 100%)` 
      }, { status: 400 })
    }

    // Create new criterion
    const [criterion] = await db
      .insert(criteria)
      .values({
        eventId,
        name: name.trim(),
        description: description?.trim() || null,
        minScore,
        maxScore,
        displayOrder: nextDisplayOrder,
        weight,
        category
      })
      .returning()

    return NextResponse.json({ criterion })
  } catch (error) {
    console.error('Error creating criterion:', error)
    
    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('duplicate key')) {
      if (error.message.includes('criteria_event_id_name_key')) {
        return NextResponse.json({ error: 'A criterion with this name already exists' }, { status: 400 })
      }
      if (error.message.includes('criteria_event_id_display_order_key')) {
        return NextResponse.json({ error: 'A criterion with this display order already exists' }, { status: 400 })
      }
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}