import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { scores, teams, criteria, users, events } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    // Get all scores with judge, team, and criterion details
    const allScores = await db
      .select({
        score: scores.score,
        comment: scores.comment,
        updatedAt: scores.updatedAt,
        judge: {
          id: users.id,
          email: users.email
        },
        team: {
          id: teams.id,
          name: teams.name,
          presentationOrder: teams.presentationOrder
        },
        criterion: {
          id: criteria.id,
          name: criteria.name,
          displayOrder: criteria.displayOrder
        }
      })
      .from(scores)
      .innerJoin(teams, eq(scores.teamId, teams.id))
      .innerJoin(criteria, eq(scores.criterionId, criteria.id))
      .innerJoin(users, eq(scores.judgeId, users.id))
      .where(eq(teams.eventId, eventId))
      .orderBy(users.email, teams.presentationOrder, criteria.displayOrder)

    // Create CSV content
    let csvContent = 'Judge Email,Team Name,Team Order,Criterion Name,Score,Comment,Updated At\n'
    
    allScores.forEach((row) => {
      // Escape fields that might contain commas or quotes
      const teamName = `"${row.team.name.replace(/"/g, '""')}"`
      const criterionName = `"${row.criterion.name.replace(/"/g, '""')}"`
      const comment = row.comment ? `"${row.comment.replace(/"/g, '""')}"` : '""'
      const updatedAt = new Date(row.updatedAt).toISOString()
      
      const csvRow = [
        row.judge.email,
        teamName,
        row.team.presentationOrder,
        criterionName,
        row.score,
        comment,
        updatedAt
      ].join(',')
      
      csvContent += csvRow + '\n'
    })

    // Get event name for filename
    const eventResult = await db
      .select({ name: events.name })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1)
    
    const eventName = eventResult[0]?.name || 'event'
    const safeEventName = eventName.replace(/[^a-z0-9]/gi, '-').toLowerCase()

    // Set response headers for CSV download
    const headers = new Headers()
    headers.set('Content-Type', 'text/csv')
    headers.set('Content-Disposition', `attachment; filename="judge-scores-detail-${safeEventName}-${new Date().toISOString().split('T')[0]}.csv"`)

    return new NextResponse(csvContent, { headers })
  } catch (error) {
    console.error('Error exporting judge scores:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}