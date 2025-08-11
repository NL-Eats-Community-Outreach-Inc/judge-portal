'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { ExternalLink, Check, AlertCircle, Loader2, Plus, Minus, AlertTriangle, Trophy, Briefcase, Target, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/use-debounce'
import type { Team, Criterion } from '@/lib/db/schema'
import ReactMarkdown from 'react-markdown'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CompletionConfetti } from '@/components/completion-confetti'
import { useJudgeAssignmentContext } from '@/app/judge/components/judge-assignment-provider'

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

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'validation-warning'

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
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [previousCompletionState, setPreviousCompletionState] = useState(false)
  
  const { isFullyComplete, event } = useJudgeAssignmentContext()

  // Detect touch device
  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0)
    }
    checkTouchDevice()
    window.addEventListener('resize', checkTouchDevice)
    return () => window.removeEventListener('resize', checkTouchDevice)
  }, [])

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
    
    // Don't save if score is null but comment exists (database constraint)
    // Set a persistent validation warning instead of a temporary error
    if (score === null && comment) {
      setSaveStatus(prev => ({ ...prev, [criterionId]: 'validation-warning' }))
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

    // Clear validation warning when score is set
    setSaveStatus(prev => {
      const current = prev[criterionId]
      if (current === 'validation-warning') {
        return { ...prev, [criterionId]: 'idle' }
      }
      return prev
    })

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

  // Check for full event completion and trigger confetti
  useEffect(() => {
    if (isFullyComplete && !previousCompletionState && event) {
      const confettiKey = `judgeportal-event-${event.id}-completed`
      const hasShownConfetti = localStorage.getItem(confettiKey)
      
      if (!hasShownConfetti) {
        setShowConfetti(true)
        localStorage.setItem(confettiKey, 'true')
      }
    }
    setPreviousCompletionState(isFullyComplete)
  }, [isFullyComplete, previousCompletionState, event])

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

  const getAwardTypeBadge = (awardType: string) => {
    switch (awardType) {
      case 'technical':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
            <Trophy className="h-3 w-3 mr-1.5" />
            Competing for Technical Award
          </Badge>
        )
      case 'business':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
            <Briefcase className="h-3 w-3 mr-1.5" />
            Competing for Business Award
          </Badge>
        )
      case 'both':
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
            <Target className="h-3 w-3 mr-1.5" />
            Competing for General Award
          </Badge>
        )
      default:
        return null
    }
  }

  const renderCriterionDescription = (criterion: Criterion) => {
    if (!criterion.description) return null

    const fullDescription = (
      <div className="prose prose-xs dark:prose-invert max-w-none text-xs">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-1.5 last:mb-0 text-xs">{children}</p>,
            ul: ({ children }) => <ul className="mb-1.5 ml-3 list-disc last:mb-0 text-xs">{children}</ul>,
            ol: ({ children }) => <ol className="mb-1.5 ml-3 list-decimal last:mb-0 text-xs">{children}</ol>,
            li: ({ children }) => <li className="mb-0.5 text-xs">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold text-xs">{children}</strong>,
            em: ({ children }) => <em className="italic text-xs">{children}</em>,
          }}
        >
          {criterion.description}
        </ReactMarkdown>
      </div>
    )

    const truncatedDescription = (
      <div className="text-xs md:text-sm text-muted-foreground mt-1 prose prose-sm dark:prose-invert max-w-none line-clamp-3">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="mb-1 ml-4 list-disc last:mb-0">{children}</ul>,
            ol: ({ children }) => <ol className="mb-1 ml-4 list-decimal last:mb-0">{children}</ol>,
            li: ({ children }) => <li className="mb-0.5">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
          }}
        >
          {criterion.description}
        </ReactMarkdown>
      </div>
    )

    if (isTouchDevice) {
      // Mobile/Tablet: Show info icon with popover
      return (
        <div className="flex items-start gap-2">
          <div className="flex-1">
            {truncatedDescription}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5"
              >
                <Info className="h-3 w-3" />
                <span className="sr-only">View full description</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" side="top" align="end">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">{criterion.name}</h4>
                {fullDescription}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )
    } else {
      // Desktop: Show tooltip on hover
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              {truncatedDescription}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-80 p-4" side="top" align="start">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">{criterion.name}</h4>
              {fullDescription}
            </div>
          </TooltipContent>
        </Tooltip>
      )
    }
  }

  const renderScoreInput = (criterion: Criterion, score: Score | undefined) => {
    const range = criterion.maxScore - criterion.minScore + 1
    
    // Small range (≤ 10): Square buttons
    if (range <= 10) {
      return (
        <div className="flex flex-wrap gap-1.5 md:gap-2">
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
                  "w-9 h-9 md:w-10 md:h-10 text-sm transition-all duration-200 hover:scale-105",
                  isSelected && "ring-2 ring-ring ring-offset-1 md:ring-offset-2 bg-gradient-to-r from-primary to-primary/90"
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
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 md:gap-2 max-w-full sm:max-w-[280px] lg:max-w-[300px]">
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
                  "w-full h-8 md:h-9 text-xs md:text-sm transition-all duration-200 hover:scale-105",
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
        <div className="space-y-3 md:space-y-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-14 md:w-16 text-center">
              <span className="text-xl md:text-2xl font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
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
          <div className="flex gap-1.5 md:gap-2 w-full">
            {presets.map((preset) => (
              <Button
                key={preset}
                variant={score?.score === preset ? "default" : "outline"}
                size="sm"
                onClick={() => handleScoreChange(criterion.id, preset)}
                className={cn(
                  "flex-1 text-xs px-1 md:px-2 h-8 md:h-9 transition-all duration-200 hover:scale-105 min-w-0",
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
        <div className="flex items-center gap-2 md:gap-3 max-w-full sm:max-w-[280px] lg:max-w-[300px]">
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
            className="h-9 w-9 md:h-10 md:w-10 transition-all duration-200 hover:scale-110 hover:bg-muted"
          >
            <Minus className="h-3 w-3 md:h-4 md:w-4" />
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
            className="text-center font-semibold text-lg md:text-xl bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20"
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
            className="h-9 w-9 md:h-10 md:w-10 transition-all duration-200 hover:scale-110 hover:bg-muted"
          >
            <Plus className="h-3 w-3 md:h-4 md:w-4" />
          </Button>
        </div>
        
        <div className="flex gap-1.5 md:gap-2">
          {[0, 25, 50, 75, 100].map((percent) => {
            const value = Math.round(criterion.minScore + (range - 1) * (percent / 100))
            return (
              <Button
                key={percent}
                variant={score?.score === value ? "default" : "outline"}
                size="sm"
                onClick={() => handleScoreChange(criterion.id, value)}
                className={cn(
                  "flex-1 text-xs px-2 h-8 md:h-9 transition-all duration-200 hover:scale-105",
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
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="space-y-4 md:space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 md:p-6">
            <div className="space-y-3 md:space-y-4">
              <div className="h-5 md:h-6 bg-muted animate-pulse rounded" />
              <div className="h-8 md:h-10 bg-muted animate-pulse rounded" />
              <div className="h-16 md:h-20 bg-muted animate-pulse rounded" />
            </div>
          </Card>
        ))}
      </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="space-y-4 md:space-y-6">
      {/* Team header */}
      <Card className="p-4 md:p-6">
        <div className="space-y-3 md:space-y-4">
          <div className="flex items-start justify-between min-w-0">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-foreground truncate min-w-0">
                {team.name}
              </h1>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">
                  Presentation #{team.presentationOrder}
                </Badge>
                {getAwardTypeBadge(team.awardType)}
              </div>
            </div>
          </div>
          
          {team.description && (
            <p className="text-sm md:text-base text-muted-foreground line-clamp-3 overflow-hidden break-words">
              {team.description}
            </p>
          )}
          
          {/* Project links */}
          <div className="flex flex-wrap gap-2 md:gap-3">
            {team.demoUrl && (
              <Button variant="outline" size="sm" asChild className="text-xs md:text-sm">
                <a href={team.demoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 md:h-4 w-3 md:w-4 mr-1.5 md:mr-2" />
                  View Demo
                </a>
              </Button>
            )}
            {team.repoUrl && (
              <Button variant="outline" size="sm" asChild className="text-xs md:text-sm">
                <a href={team.repoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 md:h-4 w-3 md:w-4 mr-1.5 md:mr-2" />
                  View Repository
                </a>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Scoring criteria */}
      <div className="space-y-3 md:space-y-4">
        <h2 className="text-lg md:text-xl font-semibold text-foreground">
          Scoring Criteria
        </h2>
        
        {criteria.map((criterion) => {
          const score = scores.find(s => s.criterionId === criterion.id)
          
          return (
            <Card key={criterion.id} className="p-4 md:p-6">
              <div className="space-y-3 md:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0 sm:pr-4">
                    <h3 className="font-semibold text-foreground text-sm md:text-base">
                      {criterion.name}
                    </h3>
                    {renderCriterionDescription(criterion)}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getSaveStatusIcon(criterion.id)}
                    <Badge variant="secondary" className="text-xs">
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
                  {/* Show inline warning when there's a comment without score */}
                  {score?.score === null && score?.comment && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm mt-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Please set a score before adding comments</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      
      {/* Progress indicator */}
      <Card className="p-3 md:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs md:text-sm font-medium text-foreground">
              Progress: {scores.filter(s => s.id).length} of {criteria.length} criteria scored
            </p>
            <p className="text-xs text-muted-foreground">
              Your scores are saved automatically
            </p>
          </div>
          <div className="w-full sm:w-32 bg-muted rounded-full h-2">
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
      
      {/* Confetti for full event completion */}
      <CompletionConfetti 
        show={showConfetti} 
        onComplete={() => setShowConfetti(false)} 
      />
    </div>
  )
}