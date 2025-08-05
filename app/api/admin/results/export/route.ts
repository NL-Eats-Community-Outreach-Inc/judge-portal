import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { sql, eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const scoreMode = searchParams.get('scoreMode') || 'total'
    const awardTypeFilter = searchParams.get('awardTypeFilter') || 'all'

    // Get event information for filename
    let eventName = 'event'
    if (eventId) {
      const eventResult = await db.select({ name: events.name })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1)
      eventName = eventResult[0]?.name || 'event'
    }

    // Use the EXACT same SQL calculation logic as the main results API
    // This ensures 100% consistency between frontend display and CSV export
    const baseTeamTotalsQuery = sql`
      WITH team_weights AS (
        SELECT 
          teams.id as team_id,
          teams.award_type,
          SUM(criteria.weight) as total_weight_for_team
        FROM teams
        LEFT JOIN criteria ON criteria.event_id = teams.event_id
        WHERE ${eventId ? sql`teams.event_id = ${eventId}` : sql`1=1`}
          AND (
            (teams.award_type = 'technical' AND criteria.category = 'technical') OR
            (teams.award_type = 'business' AND criteria.category = 'business') OR
            (teams.award_type = 'both')
          )
        GROUP BY teams.id, teams.award_type
      ),
      judge_totals AS (
        SELECT 
          teams.id as "teamId",
          teams.name as "teamName",
          teams.presentation_order as "presentationOrder",
          teams.award_type as "awardType",
          scores.judge_id as "judgeId",
          users.email as "judgeEmail",
          SUM(scores.score::numeric) as judge_total,
          SUM(
            scores.score::numeric * 
            (criteria.weight::numeric / COALESCE(tw.total_weight_for_team::numeric, 100.0))
          ) as judge_weighted_total,
          COUNT(scores.score) as criteria_scored
        FROM teams
        LEFT JOIN scores ON scores.team_id = teams.id
        LEFT JOIN users ON scores.judge_id = users.id
        LEFT JOIN criteria ON scores.criterion_id = criteria.id
        LEFT JOIN team_weights tw ON tw.team_id = teams.id
        WHERE ${eventId ? sql`teams.event_id = ${eventId}` : sql`1=1`}
          AND (
            (teams.award_type = 'technical' AND criteria.category = 'technical') OR
            (teams.award_type = 'business' AND criteria.category = 'business') OR
            (teams.award_type = 'both')
          )
        GROUP BY teams.id, teams.name, teams.presentation_order, teams.award_type, scores.judge_id, users.email
      ),
      team_calculations AS (
        SELECT 
          "teamId",
          "teamName",
          "presentationOrder",
          "awardType",
          COALESCE(SUM(judge_total), 0) as total_score,
          COALESCE(AVG(judge_total), 0) as average_score,
          COALESCE(AVG(judge_weighted_total), 0) as weighted_score,
          COUNT("judgeId") as judge_count,
          SUM(criteria_scored) as total_scores
        FROM judge_totals
        WHERE judge_total IS NOT NULL
        GROUP BY "teamId", "teamName", "presentationOrder", "awardType"
      )
      SELECT 
        "teamId",
        "teamName", 
        "presentationOrder",
        "awardType",
        ROUND(total_score::numeric, 2) as "totalScore",
        ROUND(average_score::numeric, 2) as "averageScore", 
        ROUND(weighted_score::numeric, 2) as "weightedScore",
        total_scores as "totalScores",
        judge_count as "judgeCount"
      FROM team_calculations
      ORDER BY total_score DESC
    `

    const teamTotalsResult = await db.execute(baseTeamTotalsQuery)
    let teamTotals = teamTotalsResult as Array<Record<string, unknown>>

    // Apply award type filter if not 'all'
    if (awardTypeFilter !== 'all') {
      teamTotals = teamTotals.filter(team => team.awardType === awardTypeFilter)
    }

    // Sort by score mode in JavaScript after getting results (same data, different sort)
    teamTotals.sort((a, b) => {
      switch (scoreMode) {
        case 'total':
          return Number(b.totalScore) - Number(a.totalScore)
        case 'average':
          return Number(b.averageScore) - Number(a.averageScore)
        case 'weighted':
          return Number(b.weightedScore) - Number(a.weightedScore)
        default:
          return Number(b.totalScore) - Number(a.totalScore)
      }
    })

    // Create CSV content based on score mode
    const scoreModeName = scoreMode === 'total' ? 'Total Score' : 
                         scoreMode === 'average' ? 'Average Score' : 'Weighted Score'
    
    let csvContent = `Rank,Team Name,Award Type,Presentation Order,${scoreModeName},Number of Scores,Judge Count\n`
    
    teamTotals.forEach((team, index) => {
      const finalScore = scoreMode === 'total' ? Number(team.totalScore) : 
                        scoreMode === 'average' ? Number(team.averageScore) : 
                        Number(team.weightedScore)
      
      // Format award type for better readability - use "General" instead of "Both"
      const formatAwardType = (type: string) => {
        if (type === 'both') return 'General'
        return type.charAt(0).toUpperCase() + type.slice(1)
      }
      const awardType = formatAwardType(String(team.awardType))
                        
      const row = [
        index + 1,
        `"${team.teamName}"`,
        awardType,
        Number(team.presentationOrder),
        finalScore,
        Number(team.totalScores),
        Number(team.judgeCount)
      ].join(',')
      csvContent += row + '\n'
    })

    // Set response headers for CSV download with proper event name
    const headers = new Headers()
    headers.set('Content-Type', 'text/csv')
    
    // Sanitize event name for filename (remove special characters)
    const sanitizedEventName = eventName.replace(/[^a-zA-Z0-9-_]/g, '-')
    headers.set('Content-Disposition', `attachment; filename="judging-results-${sanitizedEventName}-${scoreMode}-${new Date().toISOString().split('T')[0]}.csv"`)

    return new NextResponse(csvContent, { headers })
  } catch (error) {
    console.error('Error exporting results:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}