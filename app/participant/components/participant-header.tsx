'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { UserWithRole } from '@/lib/auth';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { useParticipantEvent } from '../contexts/participant-event-context';

export function ParticipantHeader() {
  const router = useRouter();
  const { selectedEvent } = useParticipantEvent();
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchUser = useCallback(async () => {
    try {
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();

      if (error || !authUser) {
        setUser(null);
        return;
      }

      const { data: userRecord } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single();

      setUser({
        ...authUser,
        role: userRecord?.role || 'participant',
      } as UserWithRole);
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // Smart email display helpers
  const getUsername = (email: string, maxLength: number) => {
    const username = email.split('@')[0];
    return username.length > maxLength ? username.substring(0, maxLength - 3) + '...' : username;
  };

  const getDisplayEmail = (email: string, maxLength: number) => {
    return email.length > maxLength ? email.substring(0, maxLength - 3) + '...' : email;
  };

  return (
    <header className="bg-background border-b border-border shrink-0">
      <div className="min-h-16 px-4 md:px-6 flex items-center justify-between gap-4 max-w-full overflow-hidden">
        {/* Logo and title */}
        <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
          <div className="w-8 h-8 md:w-9 md:h-9 bg-gradient-to-r from-gray-700 to-gray-800 dark:from-gray-600 dark:to-gray-700 rounded-lg flex items-center justify-center shadow-sm shrink-0">
            <Users className="h-4 w-4 md:h-5 md:w-5 text-white" />
          </div>
          <div className="flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
            <div className="min-w-0 flex-1">
              <h1 className="text-base md:text-xl font-semibold text-foreground truncate">
                Participant Portal
              </h1>
              {/* Short subtitle for medium screens */}
              <p className="text-xs md:text-sm text-muted-foreground hidden sm:block lg:hidden">
                Manage teams
              </p>
              {/* Full subtitle for large screens */}
              <p className="text-xs md:text-sm text-muted-foreground hidden lg:block">
                Manage your teams and submissions
              </p>
            </div>
            {selectedEvent && (
              <div className="hidden xl:flex items-center gap-2 ml-4 pl-4 border-l border-border shrink-0">
                <span className="text-sm text-muted-foreground">Event:</span>
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {selectedEvent.name}
                </span>
                <Badge
                  variant={selectedEvent.status === 'active' ? 'default' : 'secondary'}
                  className="text-xs capitalize shrink-0"
                >
                  {selectedEvent.status}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* User menu */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <ThemeSwitcher />
          {loading ? (
            <div className="h-9 w-20 md:w-32 bg-muted animate-pulse rounded-md" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 md:px-4">
                  <User className="h-4 w-4 shrink-0" />
                  {/* Username only for sm/md screens */}
                  <span className="text-sm hidden sm:inline lg:hidden">
                    {getUsername(user.email || '', 15)}
                  </span>
                  {/* Full email for lg+ screens */}
                  <span className="text-sm hidden lg:inline">
                    {getDisplayEmail(user.email || '', 25)}
                  </span>
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
          ) : (
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="flex items-center gap-2 px-2 md:px-4"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
