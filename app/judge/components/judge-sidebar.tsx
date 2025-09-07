'use client'

import { useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, Clock, UserX, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useJudgeAssignmentContext } from './judge-assignment-provider'

interface JudgeSidebarProps {
  isMobile?: boolean
  isOpen?: boolean
  onClose?: () => void
}

export function JudgeSidebar({ isMobile = false, isOpen = false, onClose }: JudgeSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { status, teams, scoreCompletion, refreshScoreCompletion } = useJudgeAssignmentContext()

  // Extract current team ID from pathname
  const currentTeamId = pathname?.split('/').pop()

  // Redirect if on team page but no teams available
  useEffect(() => {
    if (status === 'no-event' && pathname?.includes('/judge/team/')) {
      router.push('/judge')
    }
  }, [status, pathname, router])

  // PERFORMANCE FIX: Commented out to prevent duplicate API calls
  // The completion status is already refreshed via the 'scoreUpdated' event (lines 46-55)
  // which fires after each score save. We don't need to refresh on pathname changes
  // since the completion status only changes when scores are actually saved.
  // useEffect(() => {
  //   if (status === 'assigned') {
  //     refreshScoreCompletion()
  //   }
  // }, [pathname, status, refreshScoreCompletion])

  // PERFORMANCE OPTIMIZATION: Debounce completion refresh calls to prevent excessive API requests
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const debouncedRefreshCompletion = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      if (status === 'assigned') {
        refreshScoreCompletion()
      }
    }, 1000) // Wait 1 second after last score update before refreshing completion
  }, [status, refreshScoreCompletion])

  // Keep the existing custom event listener but with debounced refresh
  useEffect(() => {
    const handleScoreUpdate = () => {
      debouncedRefreshCompletion()
    }

    window.addEventListener('scoreUpdated', handleScoreUpdate)
    return () => {
      window.removeEventListener('scoreUpdated', handleScoreUpdate)
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [debouncedRefreshCompletion])

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
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded-md hover:bg-muted/60 transition-colors"
            onClick={() => {
              router.push('/judge')
              if (isMobile && onClose) {
                onClose()
              }
            }}
            aria-label="Back to Teams Overview"
          >
            <Home className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
          <h2 className="font-semibold text-foreground">Teams</h2>
        </div>
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

  // Create not-assigned content
  const notAssignedContent = (
    <aside className={cn(
      "bg-muted/30 border-r border-border flex flex-col h-full",
      !isMobile && "w-64 lg:w-80"
    )}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded-md hover:bg-muted/60 transition-colors"
            onClick={() => {
              router.push('/judge')
              if (isMobile && onClose) {
                onClose()
              }
            }}
            aria-label="Back to Teams Overview"
          >
            <Home className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
          <h2 className="font-semibold text-foreground">Teams</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Not assigned to event
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <UserX className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Not Assigned</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You&apos;re not assigned to the active event. Contact an administrator for access.
            </p>
          </div>
        </div>
      </div>
    </aside>
  )

  // Handle different states
  if (status === 'loading') {
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

  if (status === 'not-assigned') {
    if (isMobile) {
      return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Teams Navigation</SheetTitle>
            </SheetHeader>
            {notAssignedContent}
          </SheetContent>
        </Sheet>
      )
    }
    return notAssignedContent
  }

  if (status === 'no-event' || teams.length === 0) {
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
          <div className="flex items-center gap-2">
            <button
              className="p-1.5 rounded-md hover:bg-muted/60 transition-colors"
              onClick={() => {
                router.push('/judge')
                if (isMobile && onClose) {
                  onClose()
                }
              }}
              aria-label="Back to Teams Overview"
            >
              <Home className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
            <h2 className="font-semibold text-foreground">Teams</h2>
          </div>
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