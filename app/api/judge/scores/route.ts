import { NextRequest, NextResponse } from 'next/server'
import { authServer } from '@/lib/auth'
import { db } from '@/lib/db'
import { scores, criteria, teams, events } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireAuth()
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      )
    }

    // Get the currently active event
    const activeEvent = await db.select()
      .from(events)
      .where(eq(events.status, 'active'))
      .limit(1)

    if (!activeEvent.length) {
      return NextResponse.json(
        { error: 'No active event' },
        { status: 400 }
      )
    }

    // Get all scores for this judge and team in the active event
    const judgeScores = await db.select({
      id: scores.id,
      criterionId: scores.criterionId,
      score: scores.score,
      comment: scores.comment
    })
    .from(scores)
    .where(
      and(
        eq(scores.judgeId, user.id),
        eq(scores.teamId, teamId),
        eq(scores.eventId, activeEvent[0].id)
      )
    )

    return NextResponse.json({ scores: judgeScores })
  } catch (error) {
    console.error('Error fetching scores:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scores' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireAuth()
    
    // Check if request has content
    const contentLength = request.headers.get('content-length')
    if (!contentLength || contentLength === '0') {
      return NextResponse.json(
        { error: 'Request body is empty' },
        { status: 400 }
      )
    }
    
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    const { teamId, criterionId, score, comment } = body || {}

    // Validate required fields
    if (!teamId || !criterionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get the currently active event
    const activeEvent = await db.select()
      .from(events)
      .where(eq(events.status, 'active'))
      .limit(1)

    if (!activeEvent.length) {
      return NextResponse.json(
        { error: 'No active event' },
        { status: 400 }
      )
    }

    // Verify the team belongs to the active event
    const team = await db.select({
      id: teams.id,
      eventId: teams.eventId
    })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.eventId, activeEvent[0].id)))
      .limit(1)

    if (!team.length) {
      return NextResponse.json(
        { error: 'Team not found in active event' },
        { status: 400 }
      )
    }

    // Get the criterion to validate score range and ensure it belongs to active event
    const criterion = await db.select({
      minScore: criteria.minScore,
      maxScore: criteria.maxScore,
      eventId: criteria.eventId
    })
    .from(criteria)
    .where(and(eq(criteria.id, criterionId), eq(criteria.eventId, activeEvent[0].id)))
    .limit(1)

    if (!criterion.length) {
      return NextResponse.json(
        { error: 'Invalid criterion for active event' },
        { status: 400 }
      )
    }

    // Additional validation: ensure team and criterion belong to same event
    if (team[0].eventId !== criterion[0].eventId) {
      return NextResponse.json(
        { error: 'Team and criterion must belong to the same event' },
        { status: 400 }
      )
    }

    // Validate score range only if score is provided
    if (score !== null && score !== undefined && (score < criterion[0].minScore || score > criterion[0].maxScore)) {
      return NextResponse.json(
        { error: `Score must be between ${criterion[0].minScore} and ${criterion[0].maxScore}` },
        { status: 400 }
      )
    }

    // Insert or update score
    const result = await db.insert(scores).values({
      eventId: activeEvent[0].id,
      judgeId: user.id,
      teamId,
      criterionId,
      score,
      comment: comment || null
    })
    .onConflictDoUpdate({
      target: [scores.judgeId, scores.teamId, scores.criterionId],
      set: {
        eventId: activeEvent[0].id,
        score,
        comment: comment || null,
        updatedAt: new Date().toISOString()
      }
    })
    .returning()

    return NextResponse.json({ 
      success: true, 
      score: result[0]
    })
  } catch (error) {
    console.error('Error saving score:', error)
    return NextResponse.json(
      { error: 'Failed to save score' },
      { status: 500 }
    )
  }
}