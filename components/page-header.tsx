import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons rendered on the right (wrap under the title on narrow screens). */
  actions?: ReactNode;
  className?: string;
}

/** Title row for a dashboard section or page: heading, optional description, actions. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6',
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-xl md:text-2xl font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
