'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

// Type definitions for our data
interface Team {
  id: string
  name: string
  description: string | null
  presentationOrder: number
}

interface ScoreCompletion {
  teamId: string
  completed: boolean
  partial: boolean
}

interface JudgeSidebarProps {
  isMobile?: boolean
  isOpen?: boolean
  onClose?: () => void
}

export function JudgeSidebar({ isMobile = false, isOpen = false, onClose }: JudgeSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [teams, setTeams] = useState<Team[]>([])
  const [scoreCompletion, setScoreCompletion] = useState<ScoreCompletion[]>([])
  const [loading, setLoading] = useState(true)

  // Extract current team ID from pathname
  const currentTeamId = pathname?.split('/').pop()

  // Enhanced fetch functions for real-time sync - use useCallback for stable references
  const fetchTeams = useCallback(async () => {
    try {
      const response = await fetch('/api/judge/teams')
      if (response.ok) {
        const data = await response.json()
        setTeams(data.teams || [])
        
        // If no teams and we're currently on a team page, redirect to judge main page
        if ((!data.teams || data.teams.length === 0) && pathname?.includes('/judge/team/')) {
          router.push('/judge')
        }
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
    }
  }, [pathname, router])

  const fetchScoreCompletion = useCallback(async () => {
    try {
      const response = await fetch('/api/judge/completion')
      if (response.ok) {
        const data = await response.json()
        setScoreCompletion(data.completion || [])
      }
    } catch (error) {
      console.error('Error fetching score completion:', error)
    } finally {
      setLoading(false)
    }
  }, [])


  // Initial fetch
  useEffect(() => {
    fetchTeams()
    fetchScoreCompletion()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh completion status when pathname changes (when switching teams) 
  useEffect(() => {
    if (!loading) {
      fetchScoreCompletion()
    }
  }, [pathname, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the existing custom event listener for backward compatibility with the scoring interface
  useEffect(() => {
    const handleScoreUpdate = () => {
      fetchScoreCompletion()
    }

    window.addEventListener('scoreUpdated', handleScoreUpdate)
    return () => window.removeEventListener('scoreUpdated', handleScoreUpdate)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getCompletionStatus = (teamId: string) => {
    const status = scoreCompletion.find(s => s.teamId === teamId)
    if (!status) return 'not-started'
    if (status.completed) return 'completed'
    if (status.partial) return 'partial'
    return 'not-started'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
      case 'partial':
        return <Clock className="h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
      default:
        return <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50/50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:bg-green-100/50 dark:hover:bg-green-900/40'
      case 'partial':
        return 'bg-yellow-50/50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/40'
      default:
        return 'bg-card/50 dark:bg-card/30 border-border hover:bg-muted/50 dark:hover:bg-muted/40'
    }
  }

  const handleTeamSelect = (teamId: string) => {
    router.push(`/judge/team/${teamId}`)
    // Close mobile sidebar when a team is selected
    if (isMobile && onClose) {
      onClose()
    }
  }

  // Create loading content
  const loadingContent = (
    <aside className={cn(
      "bg-muted/30 border-r border-border p-4 h-full",
      !isMobile && "w-64 lg:w-80"
    )}>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </aside>
  )

  // Create "NO EVENT" content
  const noEventContent = (
    <aside className={cn(
      "bg-muted/30 border-r border-border flex flex-col h-full",
      !isMobile && "w-64 lg:w-80"
    )}>
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Teams</h2>
        <p className="text-sm text-muted-foreground mt-1">
          No active event
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">No Active Event</h3>
            <p className="text-sm text-muted-foreground mt-1">
              There is currently no active event for judging. Please contact an administrator.
            </p>
          </div>
        </div>
      </div>
    </aside>
  )

  // Handle loading state
  if (loading) {
    if (isMobile) {
      return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Teams Navigation</SheetTitle>
            </SheetHeader>
            {loadingContent}
          </SheetContent>
        </Sheet>
      )
    }
    return loadingContent
  }

  // Handle "NO EVENT" state
  if (teams.length === 0) {
    if (isMobile) {
      return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Teams Navigation</SheetTitle>
            </SheetHeader>
            {noEventContent}
          </SheetContent>
        </Sheet>
      )
    }
    return noEventContent
  }

  const sidebarContent = (
    <aside className={cn(
      "bg-muted/30 border-r border-border flex flex-col h-full",
      !isMobile && "w-64 lg:w-80"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 
            className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors" 
            onClick={() => {
              router.push('/judge')
              if (isMobile && onClose) {
                onClose()
              }
            }}
          >
            Teams
          </h2>
          <Badge variant="secondary" className="text-xs">
            {teams.length} teams
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Select a team to start judging
        </p>
      </div>

      {/* Team list */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {teams.map((team) => {
          const status = getCompletionStatus(team.id)
          const isSelected = currentTeamId === team.id

          return (
            <Card
              key={team.id}
              className={cn(
                'p-4 cursor-pointer transition-all duration-200 border',
                getStatusColor(status),
                isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
              )}
              onClick={() => handleTeamSelect(team.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-shrink-0">
                      {getStatusIcon(status)}
                    </div>
                    <span className="font-medium text-sm truncate">
                      {team.presentationOrder}. {team.name}
                    </span>
                  </div>
                  {team.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 overflow-hidden text-ellipsis">
                      {team.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Footer with legend */}
      <div className="p-4 border-t border-border">
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
            <span className="text-muted-foreground">Complete</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
            <span className="text-muted-foreground">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Not Started</span>
          </div>
        </div>
      </div>
    </aside>
  )

  // For mobile, wrap in Sheet component
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Teams Navigation</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    )
  }

  // For desktop, return sidebar directly
  return sidebarContent
}