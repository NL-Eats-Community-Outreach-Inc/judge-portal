import Link from 'next/link';
import { ArrowRight, Check, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/theme-switcher';
import {
  JudgeVignette,
  OrganizerVignette,
  ParticipantVignette,
  ScoringPreview,
} from '@/components/landing-preview';
import { cn } from '@/lib/utils';

const FACTS = [
  'Every score saves the moment you tap it. Nothing to submit.',
  'Judges see only the criteria that apply to each team.',
  'Rankings by total, average or weighted score, exported as CSV.',
];

const ROLES = [
  {
    who: 'Judges',
    what: 'Work through the teams in presentation order and score each one on its criteria. Change a score any time while judging is open.',
    vignette: <JudgeVignette />,
  },
  {
    who: 'Participants',
    what: 'Create a team or join one with its six-character code, then edit it together until judging starts and teams lock.',
    vignette: <ParticipantVignette />,
  },
  {
    who: 'Organizers',
    what: 'Set up the event, assign judges, watch results come in and export the final ranking.',
    vignette: <OrganizerVignette />,
  },
];

const STAGES = [
  {
    name: 'Setup',
    detail: 'Organizers build the event: teams, criteria, judges.',
    tone: 'bg-secondary text-secondary-foreground',
  },
  {
    name: 'Open',
    detail: 'Participants register and form their teams.',
    tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  {
    name: 'Active',
    detail: 'Judges score. Teams are locked.',
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  {
    name: 'Completed',
    detail: 'Results stand. Exports keep working.',
    tone: 'bg-muted text-muted-foreground',
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] bg-gradient-to-b from-emerald-50/70 via-background to-background dark:from-emerald-950/25"
      />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gray-800 to-gray-950 text-white shadow-sm dark:from-gray-100 dark:to-gray-300 dark:text-gray-900">
              <Gavel className="h-4 w-4" aria-hidden="true" />
            </span>
            JudgePortal
          </Link>
          <ThemeSwitcher />
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-14 px-6 pb-24 pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16 lg:pb-32 lg:pt-24">
        <div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Scoring for competition day.
          </h1>
          <p className="mt-6 max-w-lg text-pretty text-lg text-muted-foreground">
            JudgePortal is where your competition is scored. Sign in with the account you were
            given, or create one and join your team.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-md shadow-black/10">
              <Link href="/auth/login">
                Sign in
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/auth/sign-up">Sign up</Link>
            </Button>
          </div>
          <ul className="mt-10 space-y-3 text-sm text-muted-foreground">
            {FACTS.map((fact) => (
              <li key={fact} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <ScoringPreview />
          <p className="mt-4 text-right text-xs text-muted-foreground">Sample team and scores.</p>
        </div>
      </section>

      <section className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            One place for everyone in the room
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {ROLES.map((role) => (
              <article
                key={role.who}
                className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow duration-300 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30"
              >
                {role.vignette}
                <div>
                  <h3 className="font-semibold">{role.who}</h3>
                  <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{role.what}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            How a day runs
          </h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((stage, i) => (
              <li key={stage.name} className="relative">
                {i < STAGES.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-full top-3 hidden h-px w-8 bg-border lg:block"
                  />
                )}
                <span
                  className={cn(
                    'inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                    stage.tone
                  )}
                >
                  {stage.name}
                </span>
                <p className="mt-3 text-sm text-pretty text-muted-foreground">{stage.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 JudgePortal</p>
          <p>Locked out? Ask your organizer. No email is ever sent.</p>
        </div>
      </footer>
    </main>
  );
}
