'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, BarChart3, Download, Trophy, Star, RefreshCw, Medal } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
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
  }
  criterion: {
    id: string
    name: string
    displayOrder: number
    minScore: number
    maxScore: number
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
  const [criteriaCount, setCriteriaCount] = useState(0)
  const [isLoadingResults, setIsLoadingResults] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()
  const { selectedEvent } = useAdminEvent()

  useEffect(() => {
    if (selectedEvent) {
      fetchResults()
    }
  }, [selectedEvent])


  const fetchResults = async () => {
    if (!selectedEvent) return
    
    setIsLoadingResults(true)
    try {
      const response = await fetch(`/api/admin/results?eventId=${selectedEvent.id}`)
      const data = await response.json()
      
      if (response.ok) {
        setScores(data.scores)
        setTeamTotals(data.teamTotals)
        setCriteriaAverages(data.criteriaAverages)
        setCriteriaCount(data.criteriaCount || 0)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error fetching results:', error)
      toast({
        title: 'Error',
        description: 'Failed to load results',
        variant: 'destructive'
      })
    } finally {
      setIsLoadingResults(false)
    }
  }


  const handleExport = async () => {
    if (!selectedEvent) return
    
    setIsExporting(true)
    try {
      const response = await fetch(`/api/admin/results/export?eventId=${selectedEvent.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to export results')
      }

      // Create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `judging-results-${selectedEvent?.name || 'event'}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: 'Success',
        description: 'Results exported successfully'
      })
    } catch (error) {
      console.error('Error exporting results:', error)
      toast({
        title: 'Error',
        description: 'Failed to export results',
        variant: 'destructive'
      })
    } finally {
      setIsExporting(false)
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

  const getStatsCards = () => {
    const totalScores = scores.length
    const uniqueTeams = new Set(scores.map(s => s.team.id)).size
    const uniqueJudges = new Set(scores.map(s => s.judge.id)).size
    const expectedTotalScores = uniqueTeams * uniqueJudges * criteriaCount
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

  if (isLoadingResults) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

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
    <div className="space-y-6">
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
        {getStatsCards()}
          
          {/* Team Rankings */}
          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Team Rankings</CardTitle>
                <CardDescription>
                  Teams ranked by total score across all criteria
                </CardDescription>
              </div>
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
                    <TableHead>Team</TableHead>
                    <TableHead>Total Score</TableHead>
                    <TableHead>Total Scores</TableHead>
                    <TableHead>Judge Count</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamTotals.map((team, index) => {
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
                        <TableCell className="py-4">
                          <div className="space-y-1">
                            <div className="font-semibold text-foreground">{team.teamName}</div>
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
                            {team.totalScore}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 font-medium">{team.totalScores}</TableCell>
                        <TableCell className="py-4 font-medium">{team.judgeCount}</TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-muted/60 rounded-full h-3 shadow-inner">
                              <div 
                                className={`${getProgressBarStyle(index + 1)} h-3 rounded-full shadow-sm transition-all duration-500`}
                                style={{ width: `${Math.min(criteriaCount > 0 && team.judgeCount > 0 ? (team.totalScores / (team.judgeCount * criteriaCount)) * 100 : 0, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-foreground min-w-[40px]">
                              {criteriaCount > 0 && team.judgeCount > 0 ? Math.round((team.totalScores / (team.judgeCount * criteriaCount)) * 100) : 0}%
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

      {/* Judge Scores Matrix - Three Layer: Judge → Team → Criterion */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Detailed Scores by Judge</CardTitle>
              <CardDescription>
                Individual criterion scores given by each judge to all teams
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            // Process scores data to create three-layer structure: Judge → Team → Criterion
            const uniqueTeams = Array.from(new Set(scores.map(s => s.team.id)))
              .map(teamId => ({
                id: teamId,
                name: scores.find(s => s.team.id === teamId)?.team.name || '',
                presentationOrder: scores.find(s => s.team.id === teamId)?.team.presentationOrder || 0
              }))
              .sort((a, b) => a.presentationOrder - b.presentationOrder)

            const uniqueJudges = Array.from(new Set(scores.map(s => s.judge.id)))
              .map(judgeId => ({
                id: judgeId,
                email: scores.find(s => s.judge.id === judgeId)?.judge.email || ''
              }))

            const uniqueCriteria = Array.from(new Set(scores.map(s => s.criterion.id)))
              .map(criterionId => ({
                id: criterionId,
                name: scores.find(s => s.criterion.id === criterionId)?.criterion.name || '',
                displayOrder: scores.find(s => s.criterion.id === criterionId)?.criterion.displayOrder || 0,
                maxScore: scores.find(s => s.criterion.id === criterionId)?.criterion.maxScore || 0
              }))
              .sort((a, b) => a.displayOrder - b.displayOrder)

            // Create three-layer lookup: judge[team[criterion]] = score
            const scoreMatrix: Record<string, Record<string, Record<string, number>>> = {}
            
            uniqueJudges.forEach(judge => {
              scoreMatrix[judge.id] = {}
              uniqueTeams.forEach(team => {
                scoreMatrix[judge.id][team.id] = {}
              })
            })

            // Populate the matrix with actual scores
            scores.forEach(score => {
              if (scoreMatrix[score.judge.id] && scoreMatrix[score.judge.id][score.team.id]) {
                scoreMatrix[score.judge.id][score.team.id][score.criterion.id] = score.score
              }
            })

            if (uniqueJudges.length === 0 || uniqueTeams.length === 0 || uniqueCriteria.length === 0) {
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
                    {/* Primary header row - Team names */}
                    <TableRow>
                      <TableHead 
                        className="min-w-[140px] sticky left-0 bg-background border-r border-b-0"
                        rowSpan={2}
                      >
                        <div className="flex items-center h-full">
                          <span className="font-semibold">Judge</span>
                        </div>
                      </TableHead>
                      {uniqueTeams.map((team, teamIndex) => (
                        <TableHead 
                          key={team.id} 
                          colSpan={uniqueCriteria.length}
                          className={`text-center font-semibold border-b-0 px-2 ${
                            teamIndex % 2 === 0 
                              ? 'bg-slate-50/80 dark:bg-slate-800/30' 
                              : 'bg-blue-50/80 dark:bg-blue-900/20'
                          } ${teamIndex < uniqueTeams.length - 1 ? 'border-r-2 border-border' : ''}`}
                        >
                          {team.name}
                        </TableHead>
                      ))}
                    </TableRow>
                    {/* Secondary header row - Criterion names */}
                    <TableRow>
                      {uniqueTeams.map((team, teamIndex) => 
                        uniqueCriteria.map((criterion, criterionIndex) => (
                          <TableHead 
                            key={`${team.id}-${criterion.id}`}
                            className={`text-center text-xs font-medium min-w-[80px] px-2 py-3 ${
                              teamIndex % 2 === 0 
                                ? 'bg-slate-50/60 dark:bg-slate-800/20' 
                                : 'bg-blue-50/60 dark:bg-blue-900/15'
                            } ${
                              criterionIndex === uniqueCriteria.length - 1 && teamIndex < uniqueTeams.length - 1 
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
                    {uniqueJudges.map((judge, judgeIndex) => (
                      <TableRow key={judge.id} className={judgeIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        <TableCell className="font-medium sticky left-0 bg-background border-r py-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{judge.email.split('@')[0]}</span>
                            <span className="text-xs text-muted-foreground">
                              {judge.email.split('@')[1]}
                            </span>
                          </div>
                        </TableCell>
                        {uniqueTeams.map((team, teamIndex) => 
                          uniqueCriteria.map((criterion, criterionIndex) => {
                            const score = scoreMatrix[judge.id][team.id][criterion.id]
                            const hasScore = score !== undefined
                            
                            return (
                              <TableCell 
                                key={`${team.id}-${criterion.id}`}
                                className={`text-center py-4 px-2 ${
                                  teamIndex % 2 === 0 
                                    ? 'bg-slate-50/40 dark:bg-slate-800/15' 
                                    : 'bg-blue-50/40 dark:bg-blue-900/10'
                                } ${
                                  criterionIndex === uniqueCriteria.length - 1 && teamIndex < uniqueTeams.length - 1 
                                    ? 'border-r-2 border-border' 
                                    : ''
                                }`}
                              >
                                {hasScore ? (
                                  <Badge 
                                    variant="outline" 
                                    className="font-medium bg-white/80 dark:bg-background/80 min-w-[50px]"
                                  >
                                    {score}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </TableCell>
                            )
                          })
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      </>
    </div>
  )
}