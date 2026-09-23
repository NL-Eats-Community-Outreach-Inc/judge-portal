import { Check, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/*
 * Static renderings of the product for the landing page. They reuse the same
 * primitives and class vocabulary as the judge and admin screens, so what a
 * visitor sees here is what they get after signing in. All data is sample data.
 */

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

function ScoreRow({ selected, compact = false }: { selected?: number; compact?: boolean }) {
  return (
    <div className={cn('flex flex-wrap', compact ? 'gap-1' : 'gap-1.5')} aria-hidden="true">
      {SCORES.map((value) => {
        const isSelected = value === selected;
        return (
          <span
            key={value}
            className={cn(
              buttonVariants({ variant: isSelected ? 'default' : 'outline', size: 'sm' }),
              compact ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-xs sm:h-9 sm:w-9 sm:text-sm',
              'pointer-events-none px-0',
              isSelected && 'ring-2 ring-ring ring-offset-1 ring-offset-background'
            )}
          >
            {value}
          </span>
        );
      })}
    </div>
  );
}

/** The judge's scoring screen for one sample team. */
export function ScoringPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the judge's scoring screen for a sample team: Code quality scored 8 and saved, Demo not yet scored, progress 1 of 2 criteria."
      className="relative"
    >
      <div
        aria-hidden="true"
        className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-emerald-200/60 via-teal-100/40 to-transparent blur-2xl dark:from-emerald-500/15 dark:via-teal-500/10"
      />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xl shadow-black/5 dark:shadow-black/40">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs text-muted-foreground">Presenting 3 of 8</p>
            <h3 className="text-lg font-semibold">Harbour</h3>
          </div>
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
          >
            <Trophy className="mr-1.5 h-3 w-3" aria-hidden="true" />
            Competing for Technical Award
          </Badge>
        </div>

        <div className="space-y-3 px-5 py-4 sm:px-6">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Code quality</p>
                <p className="text-xs text-muted-foreground">Structure, tests, readability</p>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                <Badge variant="secondary" className="text-xs">
                  1 - 10
                </Badge>
              </div>
            </div>
            <ScoreRow selected={8} />
          </div>

          <div className="rounded-xl border border-border bg-background p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Demo</p>
                <p className="text-xs text-muted-foreground">Did it work on stage</p>
              </div>
              <Badge variant="secondary" className="text-xs">
                1 - 10
              </Badge>
            </div>
            <ScoreRow />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/40 px-5 py-3 text-xs sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
              <div className="h-full w-1/2 rounded-full bg-emerald-500" />
            </div>
            <span className="font-medium">1 of 2 criteria scored</span>
          </div>
          <span className="text-muted-foreground">Saved automatically</span>
        </div>
      </div>
    </div>
  );
}

/** A judge's score row, mid-event. */
export function JudgeVignette() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Feasibility</p>
        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Saved
        </span>
      </div>
      <ScoreRow selected={9} compact />
    </div>
  );
}

/** The participant's join-code field. */
export function ParticipantVignette() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-4">
      <p className="text-xs font-medium text-muted-foreground">Join code</p>
      <div className="flex gap-2">
        <div className="flex h-9 flex-1 items-center rounded-md border border-input bg-transparent px-3 font-mono text-sm tracking-[0.3em]">
          K4M7QZ
        </div>
        <span className={cn(buttonVariants({ size: 'sm' }), 'pointer-events-none')}>Join</span>
      </div>
      <p className="text-xs text-muted-foreground">Skerries · 2 of 4 seats taken</p>
    </div>
  );
}

const RANKING = [
  { rank: 1, team: 'Longline', judges: 2, score: '8.68' },
  { rank: 2, team: 'Harbour', judges: 3, score: '7.80' },
  { rank: 3, team: 'Skerries', judges: 3, score: '7.52' },
];

/** The results table with its three modes. */
export function OrganizerVignette() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-4">
      <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
        {['Total', 'Average', 'Weighted'].map((mode) => (
          <span
            key={mode}
            className={cn(
              'rounded-md px-2.5 py-1',
              mode === 'Weighted' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'
            )}
          >
            {mode}
          </span>
        ))}
      </div>
      <table className="w-full text-xs">
        <tbody>
          {RANKING.map((row) => (
            <tr key={row.rank} className="border-t border-border first:border-0">
              <td className="py-1.5 pr-2 text-muted-foreground">{row.rank}</td>
              <td className="py-1.5 font-medium">{row.team}</td>
              <td className="py-1.5 text-muted-foreground">{row.judges} judges</td>
              <td className="py-1.5 text-right tabular-nums">{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
