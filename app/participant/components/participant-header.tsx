'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Menu, Settings } from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import type { UserWithRole } from '@/lib/auth';
import { ThemeSwitcher } from '@/components/theme-switcher';

interface ParticipantHeaderProps {
  user: UserWithRole;
  onMobileMenuToggle?: () => void;
}

export function ParticipantHeader({ user, onMobileMenuToggle }: ParticipantHeaderProps) {
  const router = useRouter();

  // Smart email display helpers
  const getUsername = (email: string, maxLength: number) => {
    const username = email.split('@')[0];
    return username.length > maxLength ? username.substring(0, maxLength - 3) + '...' : username;
  };

  const getDisplayEmail = (email: string, maxLength: number) => {
    return email.length > maxLength ? email.substring(0, maxLength - 3) + '...' : email;
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/');
  };

  return (
    <header className="bg-background border-b border-border shrink-0">
      <div className="min-h-16 px-4 md:px-6 flex items-center justify-between gap-4 max-w-full overflow-hidden">
        {/* Mobile menu button + Title */}
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

          {/* Title */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <h1 className="font-semibold text-sm md:text-base text-foreground truncate">
              Participant Portal
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block truncate">
              Welcome to the event participant portal
            </p>
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
              <DropdownMenuItem onClick={() => router.push('/participant/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
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
  );
}
