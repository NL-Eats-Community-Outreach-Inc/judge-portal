import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      {...props}
      className={cn(
        'h-4 w-full animate-pulse rounded bg-muted',
        className,
      )}
    />
  );
}