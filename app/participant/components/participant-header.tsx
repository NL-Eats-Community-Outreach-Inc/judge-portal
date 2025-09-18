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

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-gray-700 to-gray-800 dark:from-gray-600 dark:to-gray-700 rounded-lg flex items-center justify-center shadow-sm">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Participant Portal</h1>
                <p className="text-sm text-muted-foreground">Manage your teams and submissions</p>
              </div>
              {selectedEvent && (
                <div className="hidden lg:flex items-center gap-2 ml-6 pl-6 border-l border-border">
                  <span className="text-sm text-muted-foreground">Event:</span>
                  <span className="text-sm font-medium">{selectedEvent.name}</span>
                  <Badge
                    variant={selectedEvent.status === 'active' ? 'default' : 'secondary'}
                    className="text-xs capitalize"
                  >
                    {selectedEvent.status}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            {loading ? (
              <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
            ) : user ? (
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
            ) : (
              <Button variant="outline" onClick={handleSignOut} className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
