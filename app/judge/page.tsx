'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Users, Target, Clock, AlertCircle } from 'lucide-react'

interface Team {
  id: string
  name: string
}

export default function JudgePage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Enhanced fetch function for real-time sync using useCallback for stable reference
  const fetchTeams = useCallback(async () => {
    try {
      const response = await fetch('/api/judge/teams')
      if (response.ok) {
        const data = await response.json()
        setTeams(data.teams || [])
      } else if (response.status === 403) {
        const data = await response.json()
        if (data.errorType === 'NOT_ASSIGNED') {
          router.push('/judge/not-assigned')
          return
        }
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      setLoading(false)
    }
  }, [router])


  // Initial fetch
  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  // Show loading state
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="space-y-4 md:space-y-6">
          <div className="text-center space-y-3 md:space-y-4">
            <div className="h-7 md:h-8 bg-muted animate-pulse rounded w-48 md:w-64 mx-auto" />
            <div className="h-5 md:h-6 bg-muted animate-pulse rounded w-64 md:w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 md:h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Show "NO EVENT" page when there are no teams
  if (teams.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto min-h-full flex items-center justify-center">
        <div className="text-center space-y-4 md:space-y-6">
          <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
            <AlertCircle className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
          </div>
          <div className="space-y-2 md:space-y-3">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              No Active Event
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-xl md:max-w-2xl mx-auto px-4 md:px-0">
              There is currently no active event available for judging. 
              Please contact an administrator to activate an event.
            </p>
          </div>
          <Card className="p-4 md:p-6 max-w-sm md:max-w-md mx-auto bg-muted/30">
            <div className="space-y-2 md:space-y-3">
              <h3 className="font-semibold text-foreground text-sm md:text-base">What happens next?</h3>
              <ul className="text-xs md:text-sm text-muted-foreground space-y-1.5 md:space-y-2 text-left">
                <li>• An administrator needs to activate an event</li>
                <li>• Teams and criteria must be configured</li>
                <li>• You&apos;ll see teams appear in the sidebar once ready</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // Show normal welcome page when teams exist
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="space-y-4 md:space-y-6">
        {/* Welcome section */}
        <div className="text-center space-y-3 md:space-y-4">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Welcome to Judge Portal
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl md:max-w-2xl mx-auto px-2 md:px-0">
            Select a team from the sidebar to start judging. Your scores will be 
            automatically saved as you work.
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <Card className="p-4 md:p-6 text-center">
            <Users className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 md:mb-3 text-primary" />
            <h3 className="font-semibold text-foreground text-sm md:text-base">{teams.length} Teams</h3>
            <p className="text-xs md:text-sm text-muted-foreground">
              {teams.length === 1 ? 'Team' : 'Teams'} ready for judging
            </p>
          </Card>
          
          <Card className="p-4 md:p-6 text-center">
            <Target className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 md:mb-3 text-primary" />
            <h3 className="font-semibold text-foreground text-sm md:text-base">Criteria</h3>
            <p className="text-xs md:text-sm text-muted-foreground">
              Score across multiple criteria
            </p>
          </Card>
          
          <Card className="p-4 md:p-6 text-center">
            <Clock className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 md:mb-3 text-primary" />
            <h3 className="font-semibold text-foreground text-sm md:text-base">Auto-save</h3>
            <p className="text-xs md:text-sm text-muted-foreground">
              Your progress is saved automatically
            </p>
          </Card>
        </div>

        {/* Getting started */}
        <Card className="p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-foreground mb-3 md:mb-4">
            Getting Started
          </h2>
          <div className="space-y-2.5 md:space-y-3">
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center shrink-0">
                1
              </div>
              <p className="text-muted-foreground text-sm md:text-base">
                Select a team from the sidebar to view their project details
              </p>
            </div>
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center shrink-0">
                2
              </div>
              <p className="text-muted-foreground text-sm md:text-base">
                Score each criterion based on the project&apos;s merit
              </p>
            </div>
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center shrink-0">
                3
              </div>
              <p className="text-muted-foreground text-sm md:text-base">
                Add comments to provide valuable feedback (optional)
              </p>
            </div>
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center shrink-0">
                4
              </div>
              <p className="text-muted-foreground text-sm md:text-base">
                Move on to the next team - your scores are saved automatically
              </p>
            </div>
          </div>
        </Card>

        {/* CTA */}
        <div className="text-center">
          <p className="text-muted-foreground text-sm md:text-base px-4 md:px-0">
            Ready to start judging? Select your first team from the sidebar.
          </p>
        </div>
      </div>
    </div>
  )
}