'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, Menu } from 'lucide-react';
import { learnerNavItems } from './learner-nav-items';

interface LearnerTabletNavProps {
  onExpand: () => void;
}

export function LearnerTabletNav({ onExpand }: LearnerTabletNavProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center border-r border-violet-200/70 bg-violet-50/80 py-4 dark:border-violet-950 dark:bg-zinc-900 md:flex lg:hidden">
      <Link
        href="/learner"
        aria-label="Innovation Hub home"
        className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white"
      >
        <GraduationCap className="h-6 w-6" />
      </Link>

      <button
        type="button"
        onClick={onExpand}
        aria-label="Expand navigation"
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-violet-100 hover:text-foreground dark:hover:bg-violet-950"
      >
        <Menu className="h-5 w-5" />
      </button>

      <nav aria-label="Tablet navigation" className="flex w-full flex-col items-center gap-3 px-2">
        {learnerNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.active(pathname);

          return (
            <Link
              key={item.label}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                active
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-violet-100 dark:hover:bg-violet-950',
              ].join(' ')}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
