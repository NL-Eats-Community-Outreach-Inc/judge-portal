'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { ArrowRight, Users, Target, Clock, AlertCircle } from 'lucide-react'

interface Team {
  id: string
  name: string
}

export default function JudgePage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/judge/teams')
      if (response.ok) {
        const data = await response.json()
        setTeams(data.teams)
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      setLoading(false)
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="space-y-6">
          <div className="text-center space-y-4">
            <div className="h-8 bg-muted animate-pulse rounded w-64 mx-auto" />
            <div className="h-6 bg-muted animate-pulse rounded w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Show "NO EVENT" page when there are no teams
  if (teams.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto min-h-full flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-foreground">
              No Active Event
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              There is currently no active event available for judging. 
              Please contact an administrator to activate an event.
            </p>
          </div>
          <Card className="p-6 max-w-md mx-auto bg-muted/30">
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">What happens next?</h3>
              <ul className="text-sm text-muted-foreground space-y-2 text-left">
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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="space-y-6">
        {/* Welcome section */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome to Judge Portal
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Select a team from the sidebar to start judging. Your scores will be 
            automatically saved as you work.
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 text-center">
            <Users className="h-8 w-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold text-foreground">Teams</h3>
            <p className="text-sm text-muted-foreground">
              View teams in the sidebar
            </p>
          </Card>
          
          <Card className="p-6 text-center">
            <Target className="h-8 w-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold text-foreground">Criteria</h3>
            <p className="text-sm text-muted-foreground">
              Score across multiple criteria
            </p>
          </Card>
          
          <Card className="p-6 text-center">
            <Clock className="h-8 w-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold text-foreground">Auto-save</h3>
            <p className="text-sm text-muted-foreground">
              Your progress is saved automatically
            </p>
          </Card>
        </div>

        {/* Getting started */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Getting Started
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                1
              </div>
              <p className="text-muted-foreground">
                Select a team from the sidebar to view their project details
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                2
              </div>
              <p className="text-muted-foreground">
                Score each criterion based on the project&apos;s merit
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                3
              </div>
              <p className="text-muted-foreground">
                Add comments to provide valuable feedback (optional)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                4
              </div>
              <p className="text-muted-foreground">
                Move on to the next team - your scores are saved automatically
              </p>
            </div>
          </div>
        </Card>

        {/* CTA */}
        <div className="text-center">
          <p className="text-muted-foreground">
            Ready to start judging? Select your first team from the sidebar.
          </p>
        </div>
      </div>
    </div>
  )
}