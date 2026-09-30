import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  /** Text read by assistive technology and shown next to the spinner when `showLabel` is set. */
  label?: string;
  showLabel?: boolean;
  /** Vertical padding: full-height sections vs inline rows. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const PADDING = { sm: 'py-4', md: 'py-8', lg: 'py-12' };
const SPINNER = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };

/** Centered spinner for content that is still loading. */
export function LoadingState({
  label = 'Loading…',
  showLabel = false,
  size = 'lg',
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center justify-center gap-3', PADDING[size], className)}
    >
      <Loader2
        className={cn('animate-spin text-muted-foreground', SPINNER[size])}
        aria-hidden="true"
      />
      <span className={cn('text-sm text-muted-foreground', !showLabel && 'sr-only')}>{label}</span>
    </div>
  );
}

interface SkeletonListProps {
  rows?: number;
  /** Height of each row (Tailwind class), sized to the content it stands in for. */
  rowClassName?: string;
  className?: string;
}

/** Stacked placeholder rows sized like the list they replace. */
export function SkeletonList({ rows = 3, rowClassName = 'h-12', className }: SkeletonListProps) {
  return (
    <div className={cn('space-y-3 animate-pulse', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn('bg-muted rounded-lg', rowClassName)} />
      ))}
    </div>
  );
}
