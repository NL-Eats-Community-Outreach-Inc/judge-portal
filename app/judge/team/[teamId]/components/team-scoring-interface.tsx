'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { ExternalLink, Check, AlertCircle, Loader2, Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/use-debounce'
import type { Team, Criterion } from '@/lib/db/schema'

interface Score {
  id?: string
  criterionId: string
  score: number | null
  comment: string
}

interface TeamScoringInterfaceProps {
  team: Team
  criteria: Criterion[]
  judgeId: string
  eventId: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function TeamScoringInterface({ 
  team, 
  criteria, 
  judgeId: _, // eslint-disable-line @typescript-eslint/no-unused-vars
  eventId: __ // eslint-disable-line @typescript-eslint/no-unused-vars
}: TeamScoringInterfaceProps) {
  const [scores, setScores] = useState<Score[]>([])
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [loading, setLoading] = useState(true)
  const [lastSavedState, setLastSavedState] = useState<Record<string, { score: number | null; comment: string }>>({})

  // Use callback to ensure stable reference for real-time sync
  const fetchExistingScores = useCallback(async () => {
    try {
      const response = await fetch(`/api/judge/scores?teamId=${team.id}`)
      if (response.ok) {
        const data = await response.json()
        
        // Initialize scores array with existing scores or empty values
        const initialScores = criteria.map(criterion => {
          const existingScore = data.scores.find((s: { id?: string; criterionId: string; score: number; comment: string }) => s.criterionId === criterion.id)
          return {
            id: existingScore?.id,
            criterionId: criterion.id,
            score: existingScore?.score ?? null,
            comment: existingScore?.comment || ''
          }
        })
        
        setScores(initialScores)
        
        // Initialize lastSavedState - only track actually saved scores
        const newLastSavedState = initialScores.reduce((acc, score) => {
          if (score.id) { // Only track scores that exist in database
            acc[score.criterionId] = { score: score.score, comment: score.comment }
          }
          return acc
        }, {} as Record<string, { score: number | null; comment: string }>)
        setLastSavedState(newLastSavedState)
      }
    } catch (error) {
      console.error('Error fetching scores:', error)
    } finally {
      setLoading(false)
    }
  }, [team.id, criteria])

  // Initialize scores from database
  useEffect(() => {
    fetchExistingScores()
  }, [fetchExistingScores])


  const saveScore = useCallback(async (criterionId: string, score: number | null, comment: string) => {
    // Don't save if score is null and comment is empty
    if (score === null && !comment) {
      return
    }
    
    // Check if this score/comment combination has already been saved
    const lastSaved = lastSavedState[criterionId]
    if (lastSaved && lastSaved.score === score && lastSaved.comment === comment) {
      return // No need to save if nothing changed
    }
    
    setSaveStatus(prev => ({ ...prev, [criterionId]: 'saving' }))
    
    try {
      const response = await fetch('/api/judge/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          criterionId,
          score,
          comment
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Update the score ID if it was a new score
        setScores(prev => prev.map(s => 
          s.criterionId === criterionId 
            ? { ...s, id: data.score.id }
            : s
        ))
        
        // Update lastSavedState to prevent duplicate saves
        setLastSavedState(prev => ({ ...prev, [criterionId]: { score, comment } }))
        
        setSaveStatus(prev => ({ ...prev, [criterionId]: 'saved' }))
        
        // Notify sidebar to refresh completion status
        window.dispatchEvent(new CustomEvent('scoreUpdated'))
        
        // Clear saved status after 2 seconds
        setTimeout(() => {
          setSaveStatus(prev => ({ ...prev, [criterionId]: 'idle' }))
        }, 2000)
      } else {
        setSaveStatus(prev => ({ ...prev, [criterionId]: 'error' }))
      }
    } catch (error) {
      console.error('Error saving score:', error)
      setSaveStatus(prev => ({ ...prev, [criterionId]: 'error' }))
    }
  }, [team.id, lastSavedState])

  const handleScoreChange = (criterionId: string, newScore: number) => {
    setScores(prev => prev.map(s => 
      s.criterionId === criterionId 
        ? { ...s, score: newScore }
        : s
    ))

    // Auto-save score immediately
    const currentScore = scores.find(s => s.criterionId === criterionId)
    if (currentScore) {
      saveScore(criterionId, newScore, currentScore.comment)
    }
  }

  const handleCommentChange = (criterionId: string, newComment: string) => {
    setScores(prev => prev.map(s => 
      s.criterionId === criterionId 
        ? { ...s, comment: newComment }
        : s
    ))
  }

  // Debounced comment saving - simplified approach
  const debouncedComments = useDebounce(
    scores.reduce((acc, score) => {
      acc[score.criterionId] = score.comment
      return acc
    }, {} as Record<string, string>),
    1000
  )

  useEffect(() => {
    // Only save comments that have actually changed
    Object.entries(debouncedComments).forEach(([criterionId, comment]) => {
      const currentScore = scores.find(s => s.criterionId === criterionId)
      // Only save if score exists or comment is not empty
      if (currentScore && (currentScore.score !== null || comment)) {
        saveScore(criterionId, currentScore.score, comment)
      }
    })
  }, [debouncedComments, saveScore, scores])

  const getSaveStatusIcon = (criterionId: string) => {
    const status = saveStatus[criterionId] || 'idle'
    
    switch (status) {
      case 'saving':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'saved':
        return <Check className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const renderScoreInput = (criterion: Criterion, score: Score | undefined) => {
    const range = criterion.maxScore - criterion.minScore + 1
    
    // Small range (≤ 10): Square buttons
    if (range <= 10) {
      return (
        <div className="flex gap-2">
          {Array.from({ length: range }, (_, i) => {
            const value = criterion.minScore + i
            const isSelected = score?.score === value
            
            return (
              <Button
                key={value}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => handleScoreChange(criterion.id, value)}
                className={cn(
                  "w-10 h-10 transition-all duration-200 hover:scale-105",
                  isSelected && "ring-2 ring-ring ring-offset-2 bg-gradient-to-r from-primary to-primary/90"
                )}
              >
                {value}
              </Button>
            )
          })}
        </div>
      )
    }
    
    // Medium range (11-25): Compact grid
    if (range <= 25) {
      return (
        <div className="grid grid-cols-5 gap-2 max-w-[300px]">
          {Array.from({ length: range }, (_, i) => {
            const value = criterion.minScore + i
            const isSelected = score?.score === value
            
            return (
              <Button
                key={value}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => handleScoreChange(criterion.id, value)}
                className={cn(
                  "w-12 h-9 text-sm transition-all duration-200 hover:scale-105",
                  isSelected && "ring-2 ring-ring ring-offset-1 bg-gradient-to-r from-primary to-primary/90"
                )}
              >
                {value}
              </Button>
            )
          })}
        </div>
      )
    }
    
    // Large range (26-50): Slider with presets
    if (range <= 50) {
      const presets = [
        criterion.minScore,
        Math.floor(criterion.minScore + range * 0.25),
        Math.floor(criterion.minScore + range * 0.5),
        Math.floor(criterion.minScore + range * 0.75),
        criterion.maxScore
      ]
      
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 text-center">
              <span className="text-2xl font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                {score?.score ?? criterion.minScore}
              </span>
            </div>
            <Slider
              value={[score?.score ?? criterion.minScore]}
              onValueChange={([value]) => handleScoreChange(criterion.id, value)}
              min={criterion.minScore}
              max={criterion.maxScore}
              step={1}
              className="flex-1"
            />
          </div>
          <div className="flex gap-2">
            {presets.map((preset) => (
              <Button
                key={preset}
                variant={score?.score === preset ? "default" : "outline"}
                size="sm"
                onClick={() => handleScoreChange(criterion.id, preset)}
                className={cn(
                  "flex-1 text-xs transition-all duration-200 hover:scale-105",
                  score?.score === preset && "bg-gradient-to-r from-primary to-primary/90"
                )}
              >
                {preset}
              </Button>
            ))}
          </div>
        </div>
      )
    }
    
    // Extra large range (51+): Number input with controls
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 max-w-[300px]">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const currentValue = score?.score ?? criterion.minScore
              if (currentValue > criterion.minScore) {
                handleScoreChange(criterion.id, currentValue - 1)
              }
            }}
            disabled={score?.score === criterion.minScore}
            className="transition-all duration-200 hover:scale-110 hover:bg-muted"
          >
            <Minus className="h-4 w-4" />
          </Button>
          
          <Input
            type="number"
            value={score?.score ?? ''}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              if (!isNaN(value) && value >= criterion.minScore && value <= criterion.maxScore) {
                handleScoreChange(criterion.id, value)
              }
            }}
            min={criterion.minScore}
            max={criterion.maxScore}
            className="text-center font-semibold text-xl bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20"
            placeholder={`${criterion.minScore}-${criterion.maxScore}`}
          />
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const currentValue = score?.score ?? criterion.minScore
              if (currentValue < criterion.maxScore) {
                handleScoreChange(criterion.id, currentValue + 1)
              }
            }}
            disabled={score?.score === criterion.maxScore}
            className="transition-all duration-200 hover:scale-110 hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          {[0, 25, 50, 75, 100].map((percent) => {
            const value = Math.round(criterion.minScore + (range - 1) * (percent / 100))
            return (
              <Button
                key={percent}
                variant={score?.score === value ? "default" : "outline"}
                size="sm"
                onClick={() => handleScoreChange(criterion.id, value)}
                className={cn(
                  "flex-1 text-xs transition-all duration-200 hover:scale-105",
                  score?.score === value && "bg-gradient-to-r from-primary to-primary/90"
                )}
              >
                {value}
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <div className="space-y-4">
              <div className="h-6 bg-muted animate-pulse rounded" />
              <div className="h-10 bg-muted animate-pulse rounded" />
              <div className="h-20 bg-muted animate-pulse rounded" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Team header */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {team.name}
              </h1>
              <Badge variant="outline" className="mt-2">
                Presentation #{team.presentationOrder}
              </Badge>
            </div>
          </div>
          
          {team.description && (
            <p className="text-muted-foreground line-clamp-3 overflow-hidden break-words">
              {team.description}
            </p>
          )}
          
          {/* Project links */}
          <div className="flex flex-wrap gap-3">
            {team.demoUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={team.demoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Demo
                </a>
              </Button>
            )}
            {team.repoUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={team.repoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Repository
                </a>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Scoring criteria */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Scoring Criteria
        </h2>
        
        {criteria.map((criterion) => {
          const score = scores.find(s => s.criterionId === criterion.id)
          
          return (
            <Card key={criterion.id} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="max-w-md min-w-0 pr-4">
                    <h3 className="font-semibold text-foreground">
                      {criterion.name}
                    </h3>
                    {criterion.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2 overflow-hidden break-all">
                        {criterion.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getSaveStatusIcon(criterion.id)}
                    <Badge variant="secondary">
                      {criterion.minScore} - {criterion.maxScore}
                    </Badge>
                  </div>
                </div>
                
                {/* Score input */}
                <div className="space-y-2">
                  <Label htmlFor={`score-${criterion.id}`}>
                    Score ({criterion.minScore}-{criterion.maxScore})
                  </Label>
                  {renderScoreInput(criterion, score)}
                </div>
                
                {/* Comment input */}
                <div className="space-y-2">
                  <Label htmlFor={`comment-${criterion.id}`}>
                    Comments (optional)
                  </Label>
                  <Textarea
                    id={`comment-${criterion.id}`}
                    placeholder="Add your comments about this criterion..."
                    value={score?.comment || ''}
                    onChange={(e) => handleCommentChange(criterion.id, e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      
      {/* Progress indicator */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Progress: {scores.filter(s => s.id).length} of {criteria.length} criteria scored
            </p>
            <p className="text-xs text-muted-foreground">
              Your scores are saved automatically
            </p>
          </div>
          <div className="w-32 bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${(scores.filter(s => s.id).length / criteria.length) * 100}%` 
              }}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}