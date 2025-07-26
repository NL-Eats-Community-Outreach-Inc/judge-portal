'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, Calendar, Wifi, WifiOff } from 'lucide-react'
import { authClient } from '@/lib/auth/client'
import { useRouter } from 'next/navigation'
import type { UserWithRole } from '@/lib/auth'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { useRealtimeTable } from '@/lib/hooks/use-realtime'

interface Event {
  id: string
  name: string
  description: string | null
  status: 'setup' | 'active' | 'completed'
}

interface JudgeHeaderProps {
  user: UserWithRole
}

export function JudgeHeader({ user }: JudgeHeaderProps) {
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  // Enhanced fetch function for real-time sync - use callback to ensure stable reference
  const fetchEvent = useCallback(async () => {
    try {
      const response = await fetch('/api/judge/event')
      if (response.ok) {
        const data = await response.json()
        setEvent(data.event)
      }
    } catch (error) {
      console.error('Error fetching event:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Set up real-time sync for events table
  const { isConnected } = useRealtimeTable('events', () => {
    fetchEvent()
  }, { enabled: true })

  // Initial fetch
  useEffect(() => {
    fetchEvent()
  }, [fetchEvent])

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
      case 'setup':
        return <Badge variant="secondary">Setup</Badge>
      case 'completed':
        return <Badge variant="outline">Completed</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  return (
    <header className="bg-background border-b border-border">
      <div className="h-16 px-6 flex items-center justify-between">
        {/* Event info */}
        <div className="flex items-center gap-4">
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              <div className="h-3 w-32 bg-muted animate-pulse rounded" />
            </div>
          ) : event ? (
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-semibold text-foreground">{event.name}</h1>
                  {getStatusBadge(event.status)}
                </div>
                {/* {event.description && (
                  <p className="text-sm text-muted-foreground truncate max-w-md">
                    {event.description}
                  </p>
                )} */}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-semibold text-foreground">No Active Event</h1>
                  <Badge variant="outline" className="text-amber-600 border-amber-600 dark:text-amber-400 dark:border-amber-400">
                    Inactive
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  No event is currently active for judging
                </p>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="flex items-center gap-3">
          {/* Real-time connection indicator */}
          <div className="flex items-center gap-1">
            {isConnected ? (
              <span title="Connected - Live updates active">
                <Wifi className="h-4 w-4 text-green-500" />
              </span>
            ) : (
              <span title="Connecting...">
                <WifiOff className="h-4 w-4 text-yellow-500" />
              </span>
            )}
          </div>
          <ThemeSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="text-sm">{user.email}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {user.role}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}