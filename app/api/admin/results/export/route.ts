import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { scores, teams, criteria, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const scoreMode = searchParams.get('scoreMode') || 'total'
    const criteriaWeightsParam = searchParams.get('criteriaWeights')
    
    let criteriaWeights: Record<string, number> = {}
    if (scoreMode === 'weighted' && criteriaWeightsParam) {
      try {
        criteriaWeights = JSON.parse(criteriaWeightsParam)
      } catch {
        return NextResponse.json({ error: 'Invalid criteria weights format' }, { status: 400 })
      }
    }

    // Get all scores with team, criterion, and judge info for calculations
    const baseScoresQuery = db
      .select({
        id: scores.id,
        score: scores.score,
        team: {
          id: teams.id,
          name: teams.name,
          presentationOrder: teams.presentationOrder
        },
        criterion: {
          id: criteria.id,
          name: criteria.name,
          displayOrder: criteria.displayOrder,
          minScore: criteria.minScore,
          maxScore: criteria.maxScore
        },
        judge: {
          id: users.id,
          email: users.email
        }
      })
      .from(scores)
      .innerJoin(teams, eq(scores.teamId, teams.id))
      .innerJoin(criteria, eq(scores.criterionId, criteria.id))
      .innerJoin(users, eq(scores.judgeId, users.id))

    const allScores = eventId 
      ? await baseScoresQuery
          .where(eq(teams.eventId, eventId))
          .orderBy(teams.presentationOrder, criteria.displayOrder)
      : await baseScoresQuery
          .orderBy(teams.presentationOrder, criteria.displayOrder)

    // Calculate team totals based on score mode
    const teamTotalsMap = new Map<string, {
      teamId: string
      teamName: string
      presentationOrder: number
      totalScore: number
      averageScore: number
      weightedScore: number
      totalScores: number
      judgeCount: number
    }>()

    // Group scores by team and calculate totals
    allScores.forEach(score => {
      const teamId = score.team.id
      if (!teamTotalsMap.has(teamId)) {
        teamTotalsMap.set(teamId, {
          teamId,
          teamName: score.team.name,
          presentationOrder: score.team.presentationOrder,
          totalScore: 0,
          averageScore: 0,
          weightedScore: 0,
          totalScores: 0,
          judgeCount: 0
        })
      }
    })

    // Calculate judge-level totals first (like in frontend)
    const judgeTeamTotals = new Map<string, Map<string, { total: number, weighted: number, criteriaCount: number }>>()
    
    allScores.forEach(score => {
      const judgeId = score.judge.id
      const teamId = score.team.id
      
      if (!judgeTeamTotals.has(judgeId)) {
        judgeTeamTotals.set(judgeId, new Map())
      }
      
      if (!judgeTeamTotals.get(judgeId)!.has(teamId)) {
        judgeTeamTotals.get(judgeId)!.set(teamId, { total: 0, weighted: 0, criteriaCount: 0 })
      }
      
      const judgeTeamData = judgeTeamTotals.get(judgeId)!.get(teamId)!
      judgeTeamData.total += score.score
      judgeTeamData.criteriaCount++
      
      // Calculate weighted score
      if (scoreMode === 'weighted' && criteriaWeights[score.criterion.id]) {
        const weight = criteriaWeights[score.criterion.id] / 100
        judgeTeamData.weighted += score.score * weight
      }
    })

    // Aggregate judge totals to team totals
    for (const teamMap of judgeTeamTotals.values()) {
      teamMap.forEach((judgeData, teamId) => {
        const teamTotal = teamTotalsMap.get(teamId)!
        teamTotal.totalScore += judgeData.total
        teamTotal.weightedScore += judgeData.weighted
        teamTotal.totalScores += judgeData.criteriaCount
        teamTotal.judgeCount++
      })
    }

    // Calculate averages
    teamTotalsMap.forEach((teamTotal) => {
      if (teamTotal.judgeCount > 0) {
        teamTotal.averageScore = teamTotal.totalScore / teamTotal.judgeCount
      }
    })

    // Convert to array and sort by selected score mode
    const teamTotals = Array.from(teamTotalsMap.values()).sort((a, b) => {
      switch (scoreMode) {
        case 'total':
          return b.totalScore - a.totalScore
        case 'average':
          return b.averageScore - a.averageScore
        case 'weighted':
          return b.weightedScore - a.weightedScore
        default:
          return b.totalScore - a.totalScore
      }
    })

    // Create CSV content based on score mode
    const scoreModeName = scoreMode === 'total' ? 'Total Score' : 
                         scoreMode === 'average' ? 'Average Score' : 'Weighted Score'
    
    let csvContent = `Rank,Team Name,Presentation Order,${scoreModeName},Number of Scores,Judge Count\n`
    
    teamTotals.forEach((team, index) => {
      const finalScore = scoreMode === 'total' ? team.totalScore : 
                        scoreMode === 'average' ? team.averageScore : team.weightedScore
                        
      const row = [
        index + 1,
        `"${team.teamName}"`,
        team.presentationOrder,
        Number(finalScore.toFixed(2)),
        team.totalScores,
        team.judgeCount
      ].join(',')
      csvContent += row + '\n'
    })

    // Set response headers for CSV download
    const headers = new Headers()
    headers.set('Content-Type', 'text/csv')
    headers.set('Content-Disposition', `attachment; filename="judging-results-${scoreMode}-${new Date().toISOString().split('T')[0]}.csv"`)

    return new NextResponse(csvContent, { headers })
  } catch (error) {
    console.error('Error exporting results:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}