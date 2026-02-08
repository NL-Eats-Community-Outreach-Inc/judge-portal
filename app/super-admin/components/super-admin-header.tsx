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
import { LogOut, User, Settings, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { UserWithRole } from '@/lib/auth';
import { ThemeSwitcher } from '@/components/theme-switcher';

interface SuperAdminHeaderProps {
  onOpenSettings?: () => void;
}

export function SuperAdminHeader({ onOpenSettings }: SuperAdminHeaderProps) {
  const router = useRouter();
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
        role: userRecord?.role || 'super_admin',
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

  const getUsername = (email: string, maxLength: number) => {
    const username = email.split('@')[0];
    return username.length > maxLength ? username.substring(0, maxLength - 3) + '...' : username;
  };

  const getDisplayEmail = (email: string, maxLength: number) => {
    return email.length > maxLength ? email.substring(0, maxLength - 3) + '...' : email;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-r from-violet-600 to-purple-700 dark:from-violet-500 dark:to-purple-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-xl font-semibold text-foreground truncate">Super Admin Portal</h1>
              <p className="text-sm text-muted-foreground hidden sm:block">Platform management</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <ThemeSwitcher />
            {loading ? (
              <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2 md:px-4">
                    <User className="h-4 w-4" />
                    <span className="text-sm hidden sm:inline lg:hidden">
                      {getUsername(user.email || '', 15)}
                    </span>
                    <span className="text-sm hidden lg:inline">
                      {getDisplayEmail(user.email || '', 25)}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs hidden md:inline-flex bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800"
                    >
                      Super Admin
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem className="sm:hidden" disabled>
                    <User className="h-4 w-4 mr-2" />
                    {getDisplayEmail(user.email || '', 20)}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenSettings}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
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
