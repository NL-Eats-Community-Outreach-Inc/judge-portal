'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { learnerNavItems } from './learner-nav-items';
import { useLearnerSearch } from '../search/learner-search-provider';

export function LearnerMobileNav() {
  const pathname = usePathname();
  const { isSearchOpen, openSearch } = useLearnerSearch();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 box-border h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-violet-200/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-violet-950 md:hidden"
    >
      <div className="flex h-16 items-center justify-around">
        {learnerNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.active(pathname);

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex h-full flex-1 flex-col items-center justify-center gap-1',
                'text-xs font-medium transition-colors',
                active ? 'text-violet-600' : 'text-muted-foreground',
              ].join(' ')}
            >
              <Icon className="h-5 w-5" />
              <span>{item.mobileLabel}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={openSearch}
          aria-label="Open search"
          aria-expanded={isSearchOpen}
          className={[
            'flex h-full flex-1 flex-col items-center justify-center gap-1',
            'text-xs font-medium transition-colors',
            isSearchOpen ? 'text-violet-600' : 'text-muted-foreground',
          ].join(' ')}
        >
          <Search className="h-5 w-5" />
          <span>Search</span>
        </button>
      </div>
    </nav>
  );
}
