'use client';

import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROLE_THEME, type AppRole } from '@/lib/theme';
import { cn } from '@/lib/utils';

const RoleContext = createContext<AppRole>('admin');

const GRID_COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

/**
 * Dashboard tab strip with the role's accent on the active tab. Owns the tab
 * styling so pages only list their tabs.
 */
export function DashboardTabs({
  role,
  className,
  ...props
}: ComponentProps<typeof Tabs> & { role: AppRole }) {
  return (
    <RoleContext.Provider value={role}>
      <Tabs className={cn('space-y-6', className)} {...props} />
    </RoleContext.Provider>
  );
}

export function DashboardTabsList({
  columns,
  className,
  ...props
}: ComponentProps<typeof TabsList> & { columns: number }) {
  return (
    <TabsList
      className={cn(
        'grid w-full h-auto min-h-[3.5rem] p-1.5 rounded-xl border border-border/30 shadow-lg backdrop-blur-md bg-gradient-to-r from-card/60 via-card/70 to-card/60',
        GRID_COLUMNS[columns] ?? 'grid-cols-1',
        className
      )}
      {...props}
    />
  );
}

export function DashboardTab({
  icon: Icon,
  children,
  className,
  ...props
}: ComponentProps<typeof TabsTrigger> & { icon: LucideIcon; children: ReactNode }) {
  const role = useContext(RoleContext);
  return (
    <TabsTrigger
      className={cn(
        'flex items-center justify-center gap-2 relative group h-full min-h-[2.75rem] rounded-lg py-2.5 px-3 md:px-4 font-medium transition-all duration-300 ease-out',
        'hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40',
        'data-[state=active]:bg-gradient-to-r data-[state=active]:shadow-md',
        ROLE_THEME[role].activeTab,
        className
      )}
      {...props}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {/* below sm the icon carries the tab; the name stays for assistive technology */}
      <span className="hidden text-sm sm:inline">{children}</span>
      <span className="sr-only sm:hidden">{children}</span>
    </TabsTrigger>
  );
}

export { TabsContent as DashboardTabContent };
