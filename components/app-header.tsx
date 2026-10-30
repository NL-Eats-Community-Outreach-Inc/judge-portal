'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeSwitcher } from '@/components/theme-switcher';
import {
  LogOut,
  User,
  Menu,
  Settings,
  ChevronLeft,
  ArrowLeftRight,
  Check,
  Loader2,
} from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import { ROLE_THEME, type AppRole } from '@/lib/theme';
import { cn } from '@/lib/utils';

export interface AppHeaderProps {
  role: AppRole;
  title: ReactNode;
  subtitle?: ReactNode;
  titleAddon?: ReactNode;
  email?: string | null;
  onOpenSettings?: () => void;
  settingsHref?: string;
  onMobileMenuToggle?: () => void;
  backNav?: { label: string; href: string };
  actions?: ReactNode;
  sticky?: boolean;
  className?: string;
}

const ROLE_HOME: Record<AppRole, string> = {
  admin: '/admin',
  judge: '/judge',
  participant: '/participant',
  super_admin: '/super-admin',
  learner: '/learner',
};

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.substring(0, maxLength - 3) + '...' : value;
}

export function AppHeader({
  role,
  title,
  subtitle,
  titleAddon,
  email,
  onOpenSettings,
  settingsHref,
  onMobileMenuToggle,
  backNav,
  actions,
  sticky = false,
  className,
}: AppHeaderProps) {
  const router = useRouter();
  const [activeRole, setActiveRole] = useState<AppRole>(role);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [sessionEmail, setSessionEmail] = useState<string | null | undefined>(email);
  const [switchingRole, setSwitchingRole] = useState<AppRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const theme = ROLE_THEME[activeRole];
  const RoleIcon = theme.icon;

  useEffect(() => {
    setActiveRole(role);
  }, [role]);

  useEffect(() => {
    if (email !== undefined) {
      setSessionEmail(email);
    } else {
      let cancelled = false;

      authClient.getUser().then((user) => {
        if (!cancelled) setSessionEmail(user?.email ?? null);
      });

      return () => {
        cancelled = true;
      };
    }
  }, [email]);

  useEffect(() => {
    let cancelled = false;

    async function fetchRoles() {
      try {
        const response = await fetch('/api/user-roles');
        if (!response.ok) return;

        const data: { roles: AppRole[]; activeRole: AppRole } = await response.json();

        if (!cancelled) {
          setRoles(data.roles);
          setActiveRole(data.activeRole);
        }
      } catch {
        // Keep the current portal usable if role discovery fails.
      }
    }

    void fetchRoles();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/');
  };

  const openSettings = () => {
    if (onOpenSettings) onOpenSettings();
    else if (settingsHref) router.push(settingsHref);
  };

  const switchRole = async (nextRole: AppRole) => {
    if (nextRole === activeRole || switchingRole !== null) return;

    setSwitchingRole(nextRole);
    setRoleError(null);

    try {
      const response = await fetch('/api/user-roles/active', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setRoleError(data?.message ?? data?.error ?? 'Could not switch roles.');
        return;
      }

      setActiveRole(data.activeRole as AppRole);

      // Move to the destination portal, then refresh server-rendered data.
      router.push(ROLE_HOME[nextRole]);
      router.refresh();
    } catch {
      setRoleError('A network error occurred while switching roles.');
    } finally {
      setSwitchingRole(null);
    }
  };

  const hasSettings = Boolean(onOpenSettings || settingsHref);
  const displayEmail = sessionEmail ?? '';
  const username = displayEmail.split('@')[0];

  return (
    <header
      className={cn(
        'border-b border-border bg-background/80 backdrop-blur-sm shrink-0',
        sticky && 'sticky top-0 z-50',
        className
      )}
    >
      <div className="min-h-16 px-4 md:px-6 py-3 flex items-center justify-between gap-4 max-w-full overflow-hidden">
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 overflow-hidden">
          {backNav && (
            <>
              <button
                type="button"
                onClick={() => router.push(backNav.href)}
                className="flex items-center gap-0.5 min-h-11 text-muted-foreground hover:text-foreground transition-colors shrink-0 py-1 px-1 -ml-1 rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Back to ${backNav.label}`}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs font-medium hidden sm:inline">{backNav.label}</span>
              </button>
              <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />
            </>
          )}

          {onMobileMenuToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              onClick={onMobileMenuToggle}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          )}

          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0',
              theme.accentBg
            )}
            aria-hidden="true"
          >
            <RoleIcon className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0 overflow-hidden flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-base md:text-xl text-foreground truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block truncate">
                  {subtitle}
                </p>
              )}
            </div>
            {titleAddon && <div className="shrink-0">{titleAddon}</div>}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {actions}
          <ThemeSwitcher />

          {sessionEmail === undefined ? (
            <div className="h-9 w-32 bg-muted animate-pulse rounded-md" aria-hidden="true" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2 md:px-4"
                  aria-label="Account menu"
                >
                  <User className="h-4 w-4" />
                  <span className="text-sm hidden sm:inline lg:hidden">
                    {truncate(username, 15)}
                  </span>
                  <span className="text-sm hidden lg:inline">{truncate(displayEmail, 25)}</span>
                  <Badge
                    variant="outline"
                    className={cn('text-xs hidden md:inline-flex', theme.badge)}
                  >
                    {theme.label}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem className="sm:hidden" disabled>
                  <User className="h-4 w-4 mr-2" />
                  {truncate(displayEmail, 20)}
                </DropdownMenuItem>

                {roles.length > 1 && (
                  <>
                    <DropdownMenuItem disabled>
                      <ArrowLeftRight className="h-4 w-4 mr-2" />
                      Switch role
                    </DropdownMenuItem>

                    {roles.map((availableRole) => {
                      const option = ROLE_THEME[availableRole];
                      const OptionIcon = option.icon;
                      const isActive = availableRole === activeRole;
                      const isSwitching = switchingRole === availableRole;

                      return (
                        <DropdownMenuItem
                          key={availableRole}
                          disabled={switchingRole !== null || isActive}
                          onSelect={() => void switchRole(availableRole)}
                        >
                          <OptionIcon className="h-4 w-4 mr-2" />
                          <span>{option.label}</span>
                          {isSwitching && <Loader2 className="h-4 w-4 ml-auto animate-spin" />}
                          {isActive && <Check className="h-4 w-4 ml-auto" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </>
                )}

                {roleError && (
                  <DropdownMenuItem disabled>
                    <span className="text-destructive text-xs whitespace-normal">{roleError}</span>
                  </DropdownMenuItem>
                )}

                {hasSettings && (
                  <DropdownMenuItem onSelect={openSettings}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onSelect={() => void handleSignOut()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
