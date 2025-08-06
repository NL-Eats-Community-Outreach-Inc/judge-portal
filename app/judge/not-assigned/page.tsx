'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserX, Shield, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NotAssignedPage() {
  const router = useRouter()

  // Check if judge is now assigned when page loads
  useEffect(() => {
    const checkAssignment = async () => {
      try {
        const response = await fetch('/api/judge/teams')
        if (response.ok) {
          // If the teams API returns successfully, the judge is now assigned
          const data = await response.json()
          if (data.teams && data.teams.length > 0) {
            // Redirect to main judge page
            router.push('/judge')
          }
        }
      } catch (error) {
        // Ignore errors - stay on not-assigned page
        console.error('Error checking assignment:', error)
      }
    }

    checkAssignment()
  }, [router])
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg border-border/60">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <UserX className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Not Assigned to Event
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              You are not currently assigned to judge the active event
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground">What this means</h4>
                <p className="text-sm text-muted-foreground">
                  Only judges who have been specifically assigned to an event can access the scoring interface for that event.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground">Next steps</h4>
                <p className="text-sm text-muted-foreground">
                  Please contact the event administrator to request access to the current judging event.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              If you believe this is an error, please contact the event organizers.
            </p>
            
            <div className="flex gap-3">
              <Button asChild variant="outline" className="flex-1">
                <Link href="/auth/login" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Link>
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                className="flex-1"
              >
                Refresh Page
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}