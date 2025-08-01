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
import { LogOut, User, Calendar, Menu } from 'lucide-react'
import { authClient } from '@/lib/auth/client'
import { useRouter } from 'next/navigation'
import type { UserWithRole } from '@/lib/auth'
import { ThemeSwitcher } from '@/components/theme-switcher'

interface Event {
  id: string
  name: string
  description: string | null
  status: 'setup' | 'active' | 'completed'
}

interface JudgeHeaderProps {
  user: UserWithRole
  onMobileMenuToggle?: () => void
}

export function JudgeHeader({ user, onMobileMenuToggle }: JudgeHeaderProps) {
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
      <div className="min-h-16 px-4 md:px-6 flex items-center justify-between gap-4">
        {/* Mobile menu button + Event info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Mobile menu button - only visible on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={onMobileMenuToggle}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>

          {/* Event info */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-1">
                <div className="h-4 w-32 md:w-48 bg-muted animate-pulse rounded" />
                <div className="h-3 w-24 md:w-32 bg-muted animate-pulse rounded" />
              </div>
            ) : event ? (
              <div className="flex items-center gap-2 md:gap-3">
                <Calendar className="h-4 md:h-5 w-4 md:w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-semibold text-sm md:text-base text-foreground truncate">{event.name}</h1>
                    {getStatusBadge(event.status)}
                  </div>
                  {/* Hide description on mobile */}
                  {/* {event.description && (
                    <p className="text-sm text-muted-foreground truncate max-w-md hidden md:block">
                      {event.description}
                    </p>
                  )} */}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 md:gap-3">
                <Calendar className="h-4 md:h-5 w-4 md:w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-semibold text-sm md:text-base text-foreground">No Active Event</h1>
                    <Badge variant="outline" className="text-amber-600 border-amber-600 dark:text-amber-400 dark:border-amber-400 text-xs">
                      Inactive
                    </Badge>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                    No event is currently active for judging
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User menu */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <ThemeSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2 md:px-4">
                <User className="h-4 w-4" />
                <span className="text-sm hidden sm:inline">{user.email}</span>
                <Badge variant="outline" className="text-xs capitalize hidden md:inline-flex">
                  {user.role}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="sm:hidden" disabled>
                <User className="h-4 w-4 mr-2" />
                {user.email}
              </DropdownMenuItem>
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