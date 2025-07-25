import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId } = await params
    const { name, description, status } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Event name is required' }, { status: 400 })
    }

    // If setting event to active, ensure no other event is active
    if (status === 'active') {
      const activeEvents = await db.select()
        .from(events)
        .where(eq(events.status, 'active'))

      // Check if there's an active event that's not the current one being updated
      const otherActiveEvent = activeEvents.find(event => event.id !== eventId)
      if (otherActiveEvent) {
        return NextResponse.json({ 
          error: 'Another event is already active. Please deactivate it first.' 
        }, { status: 400 })
      }
    }

    // Update the event
    const [updatedEvent] = await db
      .update(events)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        status: status || 'setup'
      })
      .where(eq(events.id, eventId))
      .returning()

    if (!updatedEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ event: updatedEvent })
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId } = await params

    // Check if event exists before deletion
    const existingEvent = await db.select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1)

    if (!existingEvent.length) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Delete the event (cascading deletes will handle related data)
    await db.delete(events).where(eq(events.id, eventId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}