'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, BarChart3, Download, Trophy, Star, RefreshCw, Medal } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminEvent } from '../contexts/admin-event-context'

interface Score {
  id: string
  score: number
  comment: string | null
  createdAt: string
  updatedAt: string
  team: {
    id: string
    name: string
    presentationOrder: number
    awardType: 'technical' | 'business' | 'both'
  }
  criterion: {
    id: string
    name: string
    displayOrder: number
    minScore: number
    maxScore: number
    category: 'technical' | 'business'
  }
  judge: {
    id: string
    email: string
  }
}

interface TeamTotal {
  teamId: string
  teamName: string
  presentationOrder: number
  totalScore: number
  averageScore: number
  weightedScore: number
  totalScores: number
  judgeCount: number
}

interface CriteriaAverage {
  teamId: string
  teamName: string
  criterionId: string
  criterionName: string
  averageScore: number
  judgeCount: number
}


export default function ResultsDashboard() {
  const [scores, setScores] = useState<Score[]>([])
  const [teamTotals, setTeamTotals] = useState<TeamTotal[]>([])
  const [, setCriteriaAverages] = useState<CriteriaAverage[]>([])
  const [isLoadingResults, setIsLoadingResults] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingJudgeScores, setIsExportingJudgeScores] = useState(false)
  const [scoreMode, setScoreMode] = useState<'total' | 'average' | 'weighted'>('total')
  const { selectedEvent } = useAdminEvent()

  // Use useCallback to ensure stable reference for real-time sync
  const fetchResults = useCallback(async () => {
    if (!selectedEvent) return
    
    setIsLoadingResults(true)
    try {
      const response = await fetch(`/api/admin/results?eventId=${selectedEvent.id}`)
      const data = await response.json()
      
      if (response.ok) {
        setScores(data.scores)
        setTeamTotals(data.teamTotals)
        setCriteriaAverages(data.criteriaAverages)
        
        // Weights are now managed in database, no frontend initialization needed
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error fetching results:', error)
      toast.error('Error', {
        description: 'Failed to load results'
      })
    } finally {
      setIsLoadingResults(false)
    }
  }, [selectedEvent])

  
  // Note: Removed redundant team and criteria subscriptions since:
  // 1. They all call the same fetchResults function
  // 2. fetchResults gets all data in one API call
  // 3. Score changes are the most frequent and important for results
  // 4. Team/criteria changes will still be reflected when scores are updated

  // Initial fetch when selected event changes
  useEffect(() => {
    if (selectedEvent) {
      fetchResults()
    }
  }, [selectedEvent, fetchResults])


  const handleExport = async () => {
    if (!selectedEvent) return
    
    setIsExporting(true)
    try {
      // Build URL with score mode - weights come from database
      const url = new URL(`/api/admin/results/export`, window.location.origin)
      url.searchParams.set('eventId', selectedEvent.id)
      url.searchParams.set('scoreMode', scoreMode)
      
      const response = await fetch(url.toString())
      
      if (!response.ok) {
        throw new Error('Failed to export results')
      }

      // Create download link - use filename from backend Content-Disposition header
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      
      // Extract filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('content-disposition')
      const filenameMatch = contentDisposition?.match(/filename="([^"]*)"/)
      a.download = filenameMatch?.[1] || `judging-results-${selectedEvent?.name || 'event'}-${scoreMode}-${new Date().toISOString().split('T')[0]}.csv`
      
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      toast.success('Success', {
        description: `Results exported successfully (${scoreMode} scores)`
      })
    } catch (error) {
      console.error('Error exporting results:', error)
      toast.error('Error', {
        description: 'Failed to export results'
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportJudgeScores = async () => {
    if (!selectedEvent) return
    
    setIsExportingJudgeScores(true)
    try {
      const response = await fetch(`/api/admin/results/export-judge-scores?eventId=${selectedEvent.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to export judge scores')
      }

      // Create download link
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `judge-scores-detail-${selectedEvent?.name || 'event'}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      toast.success('Success', {
        description: 'Judge scores exported successfully'
      })
    } catch (error) {
      console.error('Error exporting judge scores:', error)
      toast.error('Error', {
        description: 'Failed to export judge scores'
      })
    } finally {
      setIsExportingJudgeScores(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      setup: 'outline',
      active: 'default',
      completed: 'secondary'
    }
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>
  }


  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-blue-500" />
      case 3:
        return <Medal className="h-5 w-5 text-orange-600" />
      default:
        return <span className="text-sm font-medium text-gray-500">#{rank}</span>
    }
  }

  // Helper function to calculate relevant criteria count for a team based on award type
  const getRelevantCriteriaCount = (teamId: string) => {
    return scores
      .filter(s => s.team.id === teamId)
      .reduce((criteriaSet, score) => {
        const isRelevant = score.team.awardType === 'both' ||
          score.team.awardType === score.criterion.category
        if (isRelevant) {
          criteriaSet.add(score.criterion.id)
        }
        return criteriaSet
      }, new Set()).size
  }

  // Sort teams based on selected score mode
  const sortedTeamTotals = [...teamTotals].sort((a, b) => {
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

  const getStatsCards = () => {
    const totalScores = scores.length
    const uniqueTeams = new Set(scores.map(s => s.team.id)).size
    const uniqueJudges = new Set(scores.map(s => s.judge.id)).size
    
    // Calculate expected scores based on each team's relevant criteria count
    const expectedTotalScores = teamTotals.reduce((sum, team) => {
      const relevantCriteriaCount = getRelevantCriteriaCount(team.teamId)
      return sum + (relevantCriteriaCount * team.judgeCount)
    }, 0)
    
    const completionRate = expectedTotalScores > 0 ? Math.round((totalScores / expectedTotalScores) * 100) : 0

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg mr-4 shadow-sm">
              <BarChart3 className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalScores}</p>
              <p className="text-muted-foreground text-sm">Total Scores</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg mr-4 shadow-sm">
              <Trophy className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{uniqueTeams}</p>
              <p className="text-muted-foreground text-sm">Teams Scored</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg mr-4 shadow-sm">
              <Star className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{uniqueJudges}</p>
              <p className="text-muted-foreground text-sm">Active Judges</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-lg mr-4 shadow-sm">
              <BarChart3 className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{completionRate}%</p>
              <p className="text-muted-foreground text-sm">Completion Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Remove full-page loading state to maintain visual consistency

  if (!selectedEvent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-center">No event selected</p>
          <p className="text-sm text-muted-foreground text-center">Select an event above to view results</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Results Dashboard</h2>
          <p className="text-muted-foreground">View judging results and statistics for {selectedEvent.name}</p>
        </div>
      </div>

      {/* Selected Event Info */}
      {selectedEvent && (
        <Card className={`${
          selectedEvent.status === 'active' 
            ? 'bg-gradient-to-r from-green-50/50 to-emerald-50/30 dark:from-green-800/20 dark:to-emerald-900/10 border-green-200 dark:border-green-800'
            : 'bg-gradient-to-r from-gray-50/50 to-slate-50/30 dark:from-gray-800/30 dark:to-gray-900/20 border-gray-200 dark:border-gray-700'
        } shadow-sm`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ${
                  selectedEvent.status === 'active'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                    : 'bg-gradient-to-r from-gray-700 to-gray-800 dark:from-gray-600 dark:to-gray-700'
                }`}>
                  <Trophy className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className={
                    selectedEvent.status === 'active'
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-gray-900 dark:text-gray-100'
                  }>
                    {selectedEvent.name}
                  </CardTitle>
                  <CardDescription className={
                    selectedEvent.status === 'active'
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }>
                    {selectedEvent.description || 'No description'}
                  </CardDescription>
                </div>
              </div>
              {getStatusBadge(selectedEvent.status)}
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Results Content */}
      <>
        <div className={`relative ${isLoadingResults ? 'opacity-60 pointer-events-none' : ''} transition-opacity duration-200`}>
          {getStatsCards()}
        </div>
          
          {/* Team Rankings */}
          <Card className={`relative ${isLoadingResults ? 'opacity-60' : ''} transition-opacity duration-200`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Team Rankings</CardTitle>
                <CardDescription>
                  Teams ranked by {scoreMode === 'total' ? 'total' : scoreMode === 'average' ? 'average' : 'weighted'} score across all criteria
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Select value={scoreMode} onValueChange={(value: 'total' | 'average' | 'weighted') => setScoreMode(value)}>
                  <SelectTrigger className="w-56 bg-gradient-to-r from-slate-50/50 to-blue-50/30 dark:from-slate-800/30 dark:to-blue-900/20 border-slate-200 dark:border-slate-700 shadow-sm">
                    <SelectValue>
                      {scoreMode === 'total' && 'Total Score'}
                      {scoreMode === 'average' && 'Average Score'}
                      {scoreMode === 'weighted' && 'Weighted Score'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-background/95 backdrop-blur-sm border border-border/50 shadow-lg">
                    <SelectItem value="total" className="cursor-pointer hover:bg-accent/80 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-medium">Total Score</span>
                        <span className="text-xs text-muted-foreground">Sum of all judges&apos; total scores</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="average" className="cursor-pointer hover:bg-accent/80 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-medium">Average Score</span>
                        <span className="text-xs text-muted-foreground">Average of all judges&apos; total scores</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="weighted" className="cursor-pointer hover:bg-accent/80 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-medium">Weighted Score</span>
                        <span className="text-xs text-muted-foreground">Weighted by pre-defined criteria importance</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={fetchResults}
                  disabled={isLoadingResults}
                  className="flex items-center gap-2"
                >
                  {isLoadingResults ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh
                </Button>
              <Button 
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center gap-2"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export CSV
              </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {teamTotals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p>No scores yet</p>
              <p className="text-sm">Results will appear here as judges submit scores</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead className="w-[150px] max-w-[150px]">Team</TableHead>
                    <TableHead>Final Score</TableHead>
                    <TableHead>Total Scores</TableHead>
                    <TableHead>Judge Count</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTeamTotals.map((team, index) => {
                    const getRankStyle = (rank: number) => {
                      switch (rank) {
                        case 1:
                          return 'bg-gradient-to-r from-amber-50/80 via-yellow-50/60 to-amber-50/80 dark:from-amber-900/30 dark:via-yellow-900/20 dark:to-amber-900/30 border-l-4 border-l-amber-400 dark:border-l-amber-500'
                        case 2:
                          return 'bg-gradient-to-r from-blue-50/80 via-cyan-50/60 to-blue-50/80 dark:from-blue-900/40 dark:via-cyan-900/25 dark:to-blue-900/40 border-l-4 border-l-blue-400 dark:border-l-blue-400'
                        case 3:
                          return 'bg-gradient-to-r from-orange-50/80 via-amber-50/60 to-orange-50/80 dark:from-orange-900/30 dark:via-amber-900/20 dark:to-orange-900/30 border-l-4 border-l-orange-400 dark:border-l-orange-500'
                        default:
                          return 'hover:bg-muted/30 transition-colors'
                      }
                    }

                    const getProgressBarStyle = (rank: number) => {
                      switch (rank) {
                        case 1:
                          return 'bg-gradient-to-r from-amber-400 to-yellow-500 dark:from-amber-500 dark:to-yellow-400'
                        case 2:
                          return 'bg-gradient-to-r from-blue-400 to-cyan-500 dark:from-blue-400 dark:to-cyan-400'
                        case 3:
                          return 'bg-gradient-to-r from-orange-400 to-amber-500 dark:from-orange-500 dark:to-amber-400'
                        default:
                          return 'bg-gradient-to-r from-slate-400 to-gray-500 dark:from-slate-500 dark:to-gray-400'
                      }
                    }

                    return (
                      <TableRow key={team.teamId} className={`${getRankStyle(index + 1)} transition-all duration-200`}>
                        <TableCell className="flex items-center gap-3 py-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background/80 shadow-sm">
                            {getRankIcon(index + 1)}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 w-[150px] max-w-[150px]">
                          <div className="space-y-1">
                            <div className="font-semibold text-foreground truncate" title={team.teamName}>
                              {team.teamName}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <span className="w-1 h-1 bg-muted-foreground/60 rounded-full"></span>
                              Order #{team.presentationOrder}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge 
                            variant={index === 0 ? 'default' : index < 3 ? 'secondary' : 'outline'}
                            className={`font-bold px-3 py-1 shadow-sm ${
                              index === 0 
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-600 dark:from-amber-600 dark:to-yellow-500 text-white' 
                                : index === 1
                                ? 'bg-gradient-to-r from-blue-500 to-cyan-600 dark:from-blue-600 dark:to-cyan-500 text-white'
                                : index === 2
                                ? 'bg-gradient-to-r from-orange-500 to-amber-600 dark:from-orange-600 dark:to-amber-500 text-white'
                                : ''
                            }`}
                          >
                            {scoreMode === 'total' ? team.totalScore : scoreMode === 'average' ? team.averageScore : team.weightedScore.toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 font-medium">{team.totalScores}</TableCell>
                        <TableCell className="py-4 font-medium">{team.judgeCount}</TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-muted/60 rounded-full h-3 shadow-inner">
                              <div 
                                className={`${getProgressBarStyle(index + 1)} h-3 rounded-full shadow-sm transition-all duration-500`}
                                style={{ 
                                  width: `${(() => {
                                    const relevantCriteriaCount = getRelevantCriteriaCount(team.teamId)
                                    return Math.min(
                                      relevantCriteriaCount > 0 && team.judgeCount > 0 
                                        ? (team.totalScores / (team.judgeCount * relevantCriteriaCount)) * 100 
                                        : 0, 
                                      100
                                    )
                                  })()}%` 
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-foreground min-w-[40px]">
                              {(() => {
                                const relevantCriteriaCount = getRelevantCriteriaCount(team.teamId)
                                return relevantCriteriaCount > 0 && team.judgeCount > 0 
                                  ? Math.round((team.totalScores / (team.judgeCount * relevantCriteriaCount)) * 100) 
                                  : 0
                              })()}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Recent Scores - Commented out for new judge scores table */}
      {/*
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Recent Scores</CardTitle>
              <CardDescription>
                Latest scores submitted by judges
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {scores.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p>No scores yet</p>
              <p className="text-sm">Individual scores will appear here as judges submit them</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Criterion</TableHead>
                    <TableHead>Judge</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.slice(0, 20).map((score) => (
                    <TableRow key={score.id}>
                      <TableCell className="font-medium">{score.team.name}</TableCell>
                      <TableCell>{score.criterion.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {score.judge.email.split('@')[0]}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {score.score}/{score.criterion.maxScore}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {score.comment || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(score.updatedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      */}

      {/* Team Scores Matrix - Single Table Layout */}
      <Card className={`relative ${isLoadingResults ? 'opacity-60' : ''} transition-opacity duration-200`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Detailed Scores by Team</CardTitle>
                <CardDescription>
                  Individual criterion scores given by each judge to all teams
                </CardDescription>
              </div>
            </div>
            <Button 
              onClick={handleExportJudgeScores}
              disabled={isExportingJudgeScores}
              className="flex items-center gap-2"
            >
              {isExportingJudgeScores ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            // Process scores data to create structure with team-specific criteria filtering
            const uniqueTeams = Array.from(new Set(scores.map(s => s.team.id)))
              .map(teamId => {
                const teamScore = scores.find(s => s.team.id === teamId)
                return {
                  id: teamId,
                  name: teamScore?.team.name || '',
                  presentationOrder: teamScore?.team.presentationOrder || 0,
                  awardType: teamScore?.team.awardType || 'both'
                }
              })
              .sort((a, b) => a.presentationOrder - b.presentationOrder)

            const uniqueJudges = Array.from(new Set(scores.map(s => s.judge.id)))
              .map(judgeId => ({
                id: judgeId,
                email: scores.find(s => s.judge.id === judgeId)?.judge.email || ''
              }))
              .sort((a, b) => a.email.localeCompare(b.email))

            // Get all available criteria sorted by display order
            const allCriteria = Array.from(new Set(scores.map(s => s.criterion.id)))
              .map(criterionId => {
                const criterionScore = scores.find(s => s.criterion.id === criterionId)
                return {
                  id: criterionId,
                  name: criterionScore?.criterion.name || '',
                  displayOrder: criterionScore?.criterion.displayOrder || 0,
                  maxScore: criterionScore?.criterion.maxScore || 0,
                  category: criterionScore?.criterion.category || 'technical'
                }
              })
              .sort((a, b) => a.displayOrder - b.displayOrder)

            // Helper function to get criteria for a specific team based on award type
            const getCriteriaForTeam = (teamAwardType: 'technical' | 'business' | 'both') => {
              return allCriteria.filter(criterion => {
                if (teamAwardType === 'both') return true
                return criterion.category === teamAwardType
              })
            }

            // Create score matrix: team[judge[criterion]] = score
            const scoreMatrix: Record<string, Record<string, Record<string, number>>> = {}
            
            uniqueTeams.forEach(team => {
              scoreMatrix[team.id] = {}
              uniqueJudges.forEach(judge => {
                scoreMatrix[team.id][judge.id] = {}
              })
            })

            // Populate the matrix with actual scores
            scores.forEach(score => {
              if (scoreMatrix[score.team.id] && scoreMatrix[score.team.id][score.judge.id]) {
                scoreMatrix[score.team.id][score.judge.id][score.criterion.id] = score.score
              }
            })

            if (uniqueJudges.length === 0 || uniqueTeams.length === 0 || allCriteria.length === 0) {
              return (
                <div className="text-center py-12 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p>No detailed scores available</p>
                  <p className="text-sm">Scores will appear here once judges start submitting</p>
                </div>
              )
            }

            return (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    {/* Primary header row - Judge names */}
                    <TableRow>
                      <TableHead 
                        className="min-w-[140px] sticky left-0 bg-background border-r border-b-0"
                        rowSpan={2}
                      >
                        <div className="flex items-center h-full">
                          <span className="font-semibold">Team</span>
                        </div>
                      </TableHead>
                      {uniqueJudges.map((judge, judgeIndex) => (
                        <TableHead 
                          key={judge.id} 
                          colSpan={allCriteria.length}
                          className={`text-center font-semibold border-b-0 px-2 w-[120px] max-w-[120px] ${
                            judgeIndex % 2 === 0 
                              ? 'bg-slate-50/80 dark:bg-slate-800/30' 
                              : 'bg-blue-50/80 dark:bg-blue-900/20'
                          } ${judgeIndex < uniqueJudges.length - 1 ? 'border-r-2 border-border' : ''}`}
                        >
                          <div className="truncate" title={judge.email}>
                            {judge.email.split('@')[0]}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                    {/* Secondary header row - Criterion names (sorted by display order) */}
                    <TableRow>
                      {uniqueJudges.map((judge, judgeIndex) => 
                        allCriteria.map((criterion, criterionIndex) => (
                          <TableHead 
                            key={`${judge.id}-${criterion.id}`}
                            className={`text-center text-xs font-medium min-w-[80px] px-2 py-3 ${
                              judgeIndex % 2 === 0 
                                ? 'bg-slate-50/60 dark:bg-slate-800/20' 
                                : 'bg-blue-50/60 dark:bg-blue-900/15'
                            } ${
                              criterionIndex === allCriteria.length - 1 && judgeIndex < uniqueJudges.length - 1 
                                ? 'border-r-2 border-border' 
                                : ''
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="truncate" title={criterion.name}>
                                {criterion.name}
                              </span>
                              <span className="text-muted-foreground text-xs mt-1">
                                /{criterion.maxScore}
                              </span>
                            </div>
                          </TableHead>
                        ))
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uniqueTeams.map((team, teamIndex) => {
                      const teamCriteria = getCriteriaForTeam(team.awardType)
                      const teamCriteriaIds = new Set(teamCriteria.map(c => c.id))
                      
                      return (
                        <TableRow key={team.id} className={teamIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          <TableCell className="font-medium sticky left-0 bg-background border-r py-4">
                            <div className="flex flex-col">
                              <span className="font-medium truncate" title={team.name}>{team.name}</span>
                              <span className="text-xs text-muted-foreground">
                                Order #{team.presentationOrder} • {team.awardType === 'both' ? 'General' : team.awardType.charAt(0).toUpperCase() + team.awardType.slice(1)}
                              </span>
                            </div>
                          </TableCell>
                          {uniqueJudges.map((judge, judgeIndex) => 
                            allCriteria.map((criterion, criterionIndex) => {
                              const score = scoreMatrix[team.id][judge.id][criterion.id]
                              const hasScore = score !== undefined
                              const isRelevantCriteria = teamCriteriaIds.has(criterion.id)
                              
                              return (
                                <TableCell 
                                  key={`${judge.id}-${criterion.id}`}
                                  className={`text-center py-4 px-2 ${
                                    judgeIndex % 2 === 0 
                                      ? 'bg-slate-50/40 dark:bg-slate-800/15' 
                                      : 'bg-blue-50/40 dark:bg-blue-900/10'
                                  } ${
                                    criterionIndex === allCriteria.length - 1 && judgeIndex < uniqueJudges.length - 1 
                                      ? 'border-r-2 border-border' 
                                      : ''
                                  } ${
                                    !isRelevantCriteria ? 'opacity-20 bg-gray-100/50 dark:bg-gray-800/30' : ''
                                  }`}
                                >
                                  {isRelevantCriteria && hasScore ? (
                                    <Badge 
                                      variant="outline" 
                                      className="font-medium bg-white/80 dark:bg-background/80 min-w-[50px]"
                                    >
                                      {score}
                                    </Badge>
                                  ) : isRelevantCriteria ? (
                                    <span className="text-muted-foreground text-sm">—</span>
                                  ) : (
                                    <span className="text-muted-foreground/50 text-xs opacity-50">
                                      N/A
                                    </span>
                                  )}
                                </TableCell>
                              )
                            })
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      </>

      {/* Subtle loading overlay */}
      {isLoadingResults && (
        <div className="fixed inset-0 bg-background/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-background/95 backdrop-blur-md border border-border/50 rounded-lg px-6 py-4 shadow-lg flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">Refreshing results...</span>
          </div>
        </div>
      )}
    </div>
  )
}