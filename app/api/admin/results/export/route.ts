import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { scores, teams } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    // Get team totals (changed from averages to sums)
    const baseQuery = db
      .select({
        teamName: teams.name,
        teamOrder: teams.presentationOrder,
        totalScore: sql<number>`COALESCE(SUM(${scores.score}), 0)`,
        totalScores: sql<number>`COUNT(${scores.score})`,
        judgeCount: sql<number>`COUNT(DISTINCT ${scores.judgeId})`
      })
      .from(teams)
      .leftJoin(scores, eq(scores.teamId, teams.id))

    const teamTotals = eventId 
      ? await baseQuery
          .where(eq(teams.eventId, eventId))
          .groupBy(teams.id, teams.name, teams.presentationOrder)
          .orderBy(sql<number>`COALESCE(SUM(${scores.score}), 0) DESC`)
      : await baseQuery
          .groupBy(teams.id, teams.name, teams.presentationOrder)
          .orderBy(sql<number>`COALESCE(SUM(${scores.score}), 0) DESC`)

    // Create simplified CSV content - just the team rankings table
    let csvContent = 'Rank,Team Name,Presentation Order,Total Score,Number of Scores,Judge Count\n'
    
    teamTotals.forEach((team, index) => {
      const row = [
        index + 1,
        `"${team.teamName}"`,
        team.teamOrder,
        Number(team.totalScore),
        team.totalScores,
        team.judgeCount
      ].join(',')
      csvContent += row + '\n'
    })

    // Set response headers for CSV download
    const headers = new Headers()
    headers.set('Content-Type', 'text/csv')
    headers.set('Content-Disposition', `attachment; filename="judging-results-${new Date().toISOString().split('T')[0]}.csv"`)

    return new NextResponse(csvContent, { headers })
  } catch (error) {
    console.error('Error exporting results:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}