import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { criteria } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ criterionId: string }> }
) {
  try {
    // Await params for Next.js 15+ compatibility
    const { criterionId } = await params
    
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description, minScore, maxScore, displayOrder } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Criteria name is required' }, { status: 400 })
    }

    if (typeof minScore !== 'number' || typeof maxScore !== 'number') {
      return NextResponse.json({ error: 'Min and max scores must be numbers' }, { status: 400 })
    }

    if (minScore >= maxScore) {
      return NextResponse.json({ error: 'Min score must be less than max score' }, { status: 400 })
    }

    if (typeof displayOrder !== 'number') {
      return NextResponse.json({ error: 'Display order must be a number' }, { status: 400 })
    }

    // Update criterion (updatedAt is handled automatically by schema)
    const [criterion] = await db
      .update(criteria)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        minScore,
        maxScore,
        displayOrder
      })
      .where(eq(criteria.id, criterionId))
      .returning()

    if (!criterion) {
      return NextResponse.json({ error: 'Criterion not found' }, { status: 404 })
    }

    return NextResponse.json({ criterion })
  } catch (error) {
    console.error('Error updating criterion:', error)
    
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ criterionId: string }> }
) {
  try {
    // Await params for Next.js 15+ compatibility
    const { criterionId } = await params
    
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete criterion (cascade will handle related scores)
    const [deletedCriterion] = await db
      .delete(criteria)
      .where(eq(criteria.id, criterionId))
      .returning()

    if (!deletedCriterion) {
      return NextResponse.json({ error: 'Criterion not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting criterion:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}