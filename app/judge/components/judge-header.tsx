'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, Calendar, Menu, UserX } from 'lucide-react'
import { authClient } from '@/lib/auth/client'
import { useRouter } from 'next/navigation'
import type { UserWithRole } from '@/lib/auth'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { useJudgeAssignmentContext } from './judge-assignment-provider'

interface JudgeHeaderProps {
  user: UserWithRole
  onMobileMenuToggle?: () => void
}

export function JudgeHeader({ user, onMobileMenuToggle }: JudgeHeaderProps) {
  const router = useRouter()
  const { status, event } = useJudgeAssignmentContext()

  // Smart email display helpers
  const getUsername = (email: string, maxLength: number) => {
    const username = email.split('@')[0]
    return username.length > maxLength ? username.substring(0, maxLength - 3) + '...' : username
  }

  const getDisplayEmail = (email: string, maxLength: number) => {
    return email.length > maxLength ? email.substring(0, maxLength - 3) + '...' : email
  }

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
    <header className="bg-background border-b border-border shrink-0">
      <div className="min-h-16 px-4 md:px-6 flex items-center justify-between gap-4 max-w-full overflow-hidden">
        {/* Mobile menu button + Event info */}
        <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
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
          <div className="flex-1 min-w-0 overflow-hidden">
            {status === 'loading' ? (
              <div className="space-y-1">
                <div className="h-4 w-32 md:w-48 bg-muted animate-pulse rounded" />
                <div className="h-3 w-24 md:w-32 bg-muted animate-pulse rounded" />
              </div>
            ) : status === 'not-assigned' ? (
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <UserX className="h-4 md:h-5 w-4 md:w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="font-semibold text-sm md:text-base text-foreground truncate min-w-0 flex-1">Not Assigned to Event</h1>
                    <Badge variant="outline" className="text-amber-600 border-amber-600 dark:text-amber-400 dark:border-amber-400 text-xs shrink-0">
                      Not Assigned
                    </Badge>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground hidden sm:block truncate">
                    Contact administrator for event access
                  </p>
                </div>
              </div>
            ) : event ? (
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <Calendar className="h-4 md:h-5 w-4 md:w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="font-semibold text-sm md:text-base text-foreground truncate min-w-0 flex-1">{event.name}</h1>
                    <div className="shrink-0">
                      {getStatusBadge(event.status)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <Calendar className="h-4 md:h-5 w-4 md:w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="font-semibold text-sm md:text-base text-foreground truncate min-w-0 flex-1">No Active Event</h1>
                    <Badge variant="outline" className="text-amber-600 border-amber-600 dark:text-amber-400 dark:border-amber-400 text-xs shrink-0">
                      Inactive
                    </Badge>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground hidden sm:block truncate">
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
                {/* Username only for sm/md screens */}
                <span className="text-sm hidden sm:inline lg:hidden">{getUsername(user.email || '', 15)}</span>
                {/* Full email for lg+ screens */}
                <span className="text-sm hidden lg:inline">{getDisplayEmail(user.email || '', 25)}</span>
                <Badge variant="outline" className="text-xs capitalize hidden md:inline-flex">
                  {user.role}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="sm:hidden" disabled>
                <User className="h-4 w-4 mr-2" />
                {getDisplayEmail(user.email || '', 20)}
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