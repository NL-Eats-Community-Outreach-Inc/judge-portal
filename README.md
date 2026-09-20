# JudgePortal

A multi-tenant judging platform for hackathons and competitive events. Organizations run events through a four-stage lifecycle, judges score teams against weighted criteria, participants register and form teams with join codes, and super admins oversee the platform.

## Features

### Super admins

- Create, edit and delete organizations
- View every user on the platform, change roles, delete accounts
- Invite admins to an organization with an invitation link
- Reassign admins whose organization was deleted

### Admins (organization-scoped)

- Events with a four-stage lifecycle: `setup` → `open` → `active` → `completed`
- Invitation links for judges, participants and admins (no email is sent; the link is shown for copying)
- Judge assignment per event, with score-preservation warnings
- Teams with award types (Technical, Business, Both), presentation order (drag and drop) and join codes
- Weighted scoring criteria (0–100 %) in two categories
- Results dashboard with Total, Average and Weighted modes, award-type filter, live refresh; equal scores carry a Tie badge
- Three CSV exports: rankings (with a `Tied` column), the full judge × criterion matrix, and every judge's comment per team and criterion; text cells that would open as a formula are prefixed with a quote
- Teams tab shows every team's join code with a copy button, so participants can join an admin-created team
- Guards: events can only be deleted in `setup`; duplicate team and criterion names are refused with a message

### Judges

- Dashboard of assigned `active` events, one URL per event
- Sidebar with per-team completion state
- Auto-saving scores and comments; only the criteria that apply to a team's award type are shown or accepted
- Membership in several organizations; join more from Settings

### Participants

- Browse `open` and `active` events from every organization, register, unregister
- Create a team (6-character join code) or join one with a code
- Edit team details, regenerate the code, leave; creator transfer when the creator leaves; the creator can remove a member while the event is open
- Teams lock when judging starts

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Supabase (Postgres, Auth) · Drizzle ORM · Tailwind CSS 3.4 · shadcn/ui · @dnd-kit · Sonner · next-themes · Vitest · Playwright

## Setup

### Prerequisites

- Node.js 20+
- A Supabase project

### Steps

1. Install

   ```bash
   git clone <repository-url>
   cd judgeportal
   npm install
   ```

2. Supabase project
   - Authentication → Sign In / Providers: enable Email, turn **off** "Confirm email" (sign-ups are password based; there is no mailer, see [Email](#email))
   - Authentication → URL Configuration: add your site URL and `http://localhost:3000/**` to the redirect list
   - Settings → API: copy the URL, anon key and service-role key; Settings → Database: copy the connection string

3. Environment

   Create `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
   SUPABASE_SERVICE_ROLE_KEY=eyJh...
   DATABASE_URL=postgresql://...
   ```

   `DATABASE_URL` can be the transaction pooler string (port 6543): `drizzle.config.ts` switches drizzle-kit to the session pooler (port 5432) on its own, because introspection through the transaction pooler intermittently fails with `Cannot read properties of undefined (reading 'replace')`.

   Optional:

   | Variable                     | Purpose                                                                                                                             |
   | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
   | `SUPABASE_ACCESS_TOKEN`      | `npm run setup:email-template` (account token from the Supabase dashboard)                                                          |
   | `AI_SCORING_URL`             | Proposal pre-screening service (see `AI/README.md`); unset → no call is made                                                        |
   | `AI_SCORING_TIMEOUT_MS`      | Timeout for that call (default 10000)                                                                                               |
   | `ALLOW_TEST_UTILITIES`       | `true` on a **test** database only; required by the Playwright helpers that create users                                            |
   | `DB_SETUP_ALLOW_ANY_PROJECT` | `true` lets `db:setup` and `db:seed` run against a project other than the test project (a genuinely new one); they refuse otherwise |
   | `BASE_URL`                   | Playwright base URL (default `http://localhost:3000`)                                                                               |

4. Database

   ```bash
   npm run db:setup     # drizzle-kit push + consolidated_setup.sql
   npm run db:update    # applies EVERY file in supabase/migrations/features/, in order
   ```

   `npm run db:setup:seed` also loads the sample organization, events, users and scores (see test accounts below).

5. Run

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

### First admin

1. Sign up at `/auth/sign-up` (Judge or Participant), or create the user in the Supabase dashboard.
2. In the dashboard (Table Editor → `users`) set `role` to `super_admin`, or to `admin` together with an `organization_id`.
3. Log in again. A super admin creates organizations and invites admins; an admin creates events.

### Seeded test accounts (`db:setup:seed`)

| Role  | Email                 | Password   |
| ----- | --------------------- | ---------- |
| Admin | `admin@example.com`   | `admin123` |
| Judge | `judge1@example.com`  | `judge123` |
| Judge | `judge2@example.com`  | `judge123` |
| Judge | `judge3@example.com`  | `judge123` |

## Email

There is no SMTP provider and none is planned; the Supabase built-in mailer allows two emails per hour for the whole project, so every email-dependent control is switched off (`EMAIL_FEATURES_ENABLED` in `lib/config.ts`):

- Login and sign-up offer the password form only.
- Invitation links do not send anything: the admin copies the link, the invitee opens it and chooses a password.
- `/auth/forgot-password` tells the user to contact the organizer. The account holder sets a new password for the user in the Supabase dashboard (Authentication → Users); the dashboard's "send password recovery" option is not used because it sends an email.

## Feature flags (`lib/config.ts`)

| Flag                     | Value   | Effect                                                                                     |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------ |
| `EMAIL_FEATURES_ENABLED` | `false` | Hides passwordless login/sign-up, the forgot-password form and the OTP invitation step      |
| `SUBMISSIONS_ENABLED`    | `false` | Hides the team proposal form; `POST /api/submissions` answers 404; scorer is never called   |

Both are compile-time constants; the code behind them is kept, not deleted.

## Commands

```bash
npm run dev                 # dev server (Turbopack)
npm run build && npm start  # production build; type and lint errors fail the build
npm run lint                # ESLint
npm run typecheck           # tsc --noEmit
npm run format[:check]      # Prettier
npm run test:unit           # Vitest (tests/unit/**)
npm run test:unit:coverage  # Vitest with the coverage report
npm run test:e2e            # Playwright (needs a running dev server and a test database)

npm run db:setup[:seed]     # create schema (+ seed)
npm run db:update [name…]   # apply all feature migrations, or the named ones
npm run db:push             # drizzle-kit push: fresh databases only. On a populated database it DROPS every
                            # RLS policy the schema does not declare (all of them); re-apply consolidated_setup.sql after it
npm run db:generate         # drizzle migration from schema diff
npm run db:studio           # Drizzle Studio
npm run db:backup           # JSON backup of DATABASE_URL into backups/
npm run db:backup:prod      # same, for the commented production URL in .env.local
npm run db:reset:test       # wipe the test project (public schema + auth users) before a from-scratch db:setup:seed + db:update
                            # db:setup runs `drizzle-kit push --force` first: it and db:seed refuse any project but the test one
                            # unless DB_SETUP_ALLOW_ANY_PROJECT=true (a fresh project); the Playwright helpers refuse it outright
npm run setup:email-template
```

`scripts/compare-databases.ts` prints schema differences between `DATABASE_URL` and `COMPARE_DATABASE_URL` (tables, columns, enums, constraints, indexes, policies, triggers, functions) and exits 2 when there are any.

## Project structure

```
app/
  super-admin/        dashboard: organizations, platform users
  admin/              dashboard: events, teams, criteria, results, users
  judge/              dashboard, event/[eventId], team scoring, settings
  participant/        dashboard, event/[eventId], settings
  invite/[token]/     invitation acceptance (password form)
  auth/               login, sign-up, forgot-password, update-password, confirm, error
  api/
    super-admin/      organizations, users, roles
    admin/            event(s), teams, criteria, event-judges, invitations, results (+ export, export-judge-scores, export-comments), users, sync-users
    judge/            event(s), teams, scores, completion, organizations
    participant/      events, registration, teams (create, join, leave, members, regenerate-code, remove a member)
    invite/           validate, accept, verify
    organizations/    public listing
    settings/         password
    submissions/      team proposals (disabled)
components/           shared UI (ui/ = shadcn primitives)
lib/
  auth/               authServer, org scoping, participant guards, invitation helpers
  db/                 schema.ts, client, errors.ts (unique-violation helper)
  supabase/           server, browser and middleware clients
  utils/              api-errors.ts, csv.ts, join-code.ts
  config.ts           feature flags
scripts/              setup, seed, migration, backup and compare scripts
supabase/migrations/  consolidated_setup.sql + features/00N_*.sql
tests/                Vitest specs (tests/unit/**), Playwright specs (tests/e2e/**)
AI/, backend/         optional proposal pre-screening service (not deployed)
```

## Database

Thirteen tables in `lib/db/schema.ts`:

| Table                  | Purpose                                                   |
| ---------------------- | --------------------------------------------------------- |
| `organizations`        | Tenants                                                   |
| `events`               | Events, status, max team size; cascade with organization  |
| `users`                | Profile row per auth user: role, organization             |
| `teams`                | Teams: award type, presentation order, join code          |
| `criteria`             | Weighted criteria per event, technical or business        |
| `scores`               | One row per judge × team × criterion                      |
| `event_judges`         | Judge assignments                                         |
| `invitations`          | Invitation tokens, role, status, expiry, organization     |
| `event_participants`   | Participant registrations                                 |
| `team_members`         | Team membership with `is_creator`                         |
| `organization_members` | Judge ↔ organization membership                           |
| `submissions`          | Team proposals (feature disabled)                         |
| `submission_ai_scores` | Pre-screening scores (feature disabled)                   |

Enums: `event_status`, `user_role`, `criteria_category`, `team_award_type`, `invitation_role`, `invitation_status`. Functions: `check_user_role`, `get_user_organization`, `handle_new_user` (trigger on `auth.users`).

Migrations: `consolidated_setup.sql` is the base; `features/` holds `001_invite-link`, `002_multi-tenant-participants`, `003_submissions`, `004_remove-learnworlds`, `005_align-constraints`. Every schema change is a new numbered file, applied to the test database first, compared, then applied to production with the identical file. Unique constraints are named differently in the two environments (`*_key` vs `*_unique`); code matches on the columns a constraint covers (`lib/db/errors.ts`), never on its name.

## Security

- Every API route starts with `authServer.require<Role>()`; admin routes add `getAdminOrgId()` and `requireEventInOrg()`.
- Roles are isolated: a super admin cannot open `/admin`, an admin cannot open `/super-admin`. An unauthenticated page request redirects to `/auth/login`; an unauthenticated API request answers `401` JSON (`error_code: UNAUTHORIZED`), and the app shows "Your session has expired" instead of an empty list.
- Row Level Security on every table.
- Invitation tokens are random UUIDs; a link is single use and expires.
- Judges only see and score the events they are assigned to; teams lock while an event is `active`.

## Testing

Two automated layers, plus a scripted manual pass:

| Layer      | Runner     | Location        | Scope                                                                                                            |
| ---------- | ---------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Unit       | Vitest     | `tests/unit/**` | Pure helpers and every route handler under `app/api/**`, with the database and auth mocked                       |
| End to end | Playwright | `tests/e2e/**`  | Real browser against `npm run dev` (or the production build) and the test Supabase project, one context per role |

### Unit tests (Vitest)

```bash
npm run test:unit                                   # all specs
npm run test:unit:coverage                          # + text and HTML coverage (coverage/) for lib/ and app/api/
npm run test:unit:watch
npx vitest run tests/unit/lib/results.spec.ts       # one spec
npx vitest run tests/unit/api/judge                 # one area
```

Configuration: `vitest.config.ts` (`environment: node`, `@/*` alias, `@vitest/coverage-v8` over `lib/**` and `app/api/**/route.ts`, no threshold gate yet).

#### Helpers (`tests/unit/test-utils/`)

| File                 | Provides                                                                                                                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mock-db.ts`         | `buildDbMock()` (the shape for `vi.mock('@/lib/db')`: `select`, `selectDistinct`, `insert`, `update`, `delete`, `execute`, `transaction`), `mockSelectSequence` (one result per `db.select()` call, in order), `buildMutationMock`, `buildFailingMutationMock`, `resetDbMock` |
| `mock-request.ts`    | `mockRequest(url, { method, body })` and `mockParams({...})` for Next 15 route handlers                                                                                                                                                                                     |
| `route-harness.ts`   | `buildAuthServerMock` / `signInAs` / `signOut` (the `authServer` object for `vi.mock('@/lib/auth')`), `buildOrgMock` / `scopeToOrg` (`getAdminOrgId`, `requireEventInOrg`), `uniqueViolation(constraint)`, `expectApiError(response, status, code)`, `expectJson`         |
| `results-fixture.ts` | The verification runbook §3 dataset in the shape `lib/db/results.ts` returns                                                                                                                                                                                                |

#### Spec layout

- `tests/unit/lib/*.spec.ts` — one file per helper module: `api-client` (`apiFetch`/`apiDownload` turn a redirect, a non-JSON 2xx or a 401 into the session-expired error), `api-errors` (every `handleRouteError` mapping, `Object.hasOwn` guard, `sendApiError` extras), `auth-org`, `auth-participant`, `auth-server` (`authServer.require*` per role), `csv` (quoting, the formula guard, filenames), `db-errors` (both constraint naming styles), `invitation` (validity, expiry, the acceptance transaction, existing-account helpers, organization-scoped case-insensitive lookup), `join-code`, `results` (the runbook dataset S0 and M1–M5, `rankTeamTotals` ties, exact rounding), `schema` (NOT NULL columns and indexes the databases carry).
- `tests/unit/api/**/route.spec.ts` — one file per route handler, mirrored from `app/api/**/route.ts` with `[param]` written as kebab-case (`app/api/admin/events/[eventId]/route.ts` → `tests/unit/api/admin/events/event-id/route.spec.ts`). Each covers, where the route has them: unauthenticated → 401, wrong role → 403, admin route with an event of another organization → 404, one validation failure → 400 with its `error_code`, the happy path (envelope and status), plus the route's own rules (event DELETE refuses non-`setup`, PUT changes only the fields present and validates `maxTeamSize`, POST creates in `setup` only, scores POST rejects `5.5` and non-applicable criteria, completion counts applicable rows only, team create maps 23505 to `DUPLICATE_TEAM_NAME` / a join-code collision to 409, reorder temporaries are deterministic, the role route refuses a super admin, another organization's admin, a judge without membership and a participant outside the organization's events, sync-users takes the role from the invitation then the metadata, the rankings export carries `Tied`, the comments export lists counted rows, a creator removes a member only while the event is open, invite accept never touches an existing account without its own session).
- `tests/unit/route-specs.spec.ts` — fails when a route file has no spec at the mirrored path.

#### Writing a route spec

```ts
vi.mock('@/lib/auth', async () => {
  const { buildAuthServerMock } = await import('@/tests/unit/test-utils/route-harness');
  return { authServer: buildAuthServerMock() };
});
vi.mock('@/lib/auth/org', async () => {
  const { buildOrgMock } = await import('@/tests/unit/test-utils/route-harness');
  return buildOrgMock();
});
vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});
// then: signInAs(auth, fakeUser('admin')); scopeToOrg(orgMock); mockSelectSequence(dbMock.select, [rows], …)
```

`mockSelectSequence` queues one result per `db.select()` call in the order the handler makes them; `db.transaction` runs its callback against the same mock, so `tx.select()` draws from the same queue.

### End-to-end tests (Playwright)

#### Environment

- A running dev server: `npm run dev` (default `http://localhost:3000`, override with `BASE_URL`).
- `.env.local` pointing at the **test** Supabase project with `ALLOW_TEST_UTILITIES=true`; the service-role helpers in `tests/e2e/support/supabase-admin.ts` refuse to load without the flag.
- Browsers: `npx playwright install chromium` for local runs (the config lists Chromium, Firefox and WebKit; CI installs all three with `--with-deps`).

#### Configuration (`playwright.config.ts`)

`testDir: ./tests/e2e`, `globalSetup: ./tests/e2e/global-setup.ts`, `workers: 1`, `fullyParallel: false`, 90 s per test, `retries: 2` on CI, HTML reporter, trace on first retry.

#### Accounts and global setup

`tests/e2e/support/accounts.ts` defines six accounts (admin, judge 1–3, participant A and B, super admin) from the `*_EMAIL` / `*_PASSWORD` variables in `.env.local`, with `*@test.com` defaults. `global-setup.ts` runs once per `playwright test` invocation: it creates or repairs every account through the service-role API (admin in the `QA Organization`, judges as its members, roles as expected), deletes any leftover `QA-` event, signs each account in through the login form and saves its storage state to `tests/e2e/.auth/<role>.json` (git-ignored). Specs open a browser context per role with `contextFor(browser, 'judge1')` and call the API as a role with the `adminApi` / `judge1Api` / … fixtures from `tests/e2e/support/fixtures.ts`. Anything that goes through the login form uses `submitLoginForm` (`tests/e2e/support/login.ts`), which re-fills the controlled inputs if hydration reset them (WebKit).

Every spec builds its own `QA-<name>-<random>` event through the admin API (`tests/e2e/support/api.ts`: `createEvent`, `addCriterion`, `addTeam`, `assignJudges`, `setEventStatus`, `postScore`, `results`, `parseCsv`) and deletes it in `afterAll` (`deleteEvent` walks the status back to `setup` first). Specs whose steps build on each other are `serial`, so a failure skips the rest instead of rerunning the setup. Sign-out revokes every session of an account, so the login spec signs in and out with throw-away accounts and leaves the shared storage states alone.

#### Running

```bash
npx playwright test --project=chromium                                  # everything (about 13 minutes)
npx playwright test --grep @smoke --project=chromium                    # login-roles, event-lifecycle, scoring
npx playwright test tests/e2e/judge/scoring.spec.ts --project=chromium  # one spec
npx playwright test tests/e2e/admin/results.spec.ts --project=chromium --debug
npx playwright show-report
RUNBOOK=1 npx playwright test tests/e2e/runbook --project=chromium      # the scripted verification pass
BURST=1 npx playwright test tests/e2e/judge/burst.spec.ts --project=chromium   # the scoring burst
```

Against the production build (what Vercel serves; the dev server compiles on demand and would measure Turbopack):

```bash
npm run build && npm start                                              # port 3000, same .env.local
npx playwright test --project=chromium --grep @smoke
RUNBOOK=1 npx playwright test tests/e2e/runbook --project=chromium
BURST=1 npx playwright test tests/e2e/judge/burst.spec.ts --project=chromium
```

The burst prints one line (`burst: 400 requests, 0 non-200, p50 … ms, p95 … ms, max … ms, … ms wall`) and attaches the per-request samples to the report; it asserts every save answers 200, p95 under 2,000 ms, and every team's Total, Average and Weighted equal to `lib/results.ts` over the posted rows.

#### Specs

| Spec                                       | Journey                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/login-roles.spec.ts` (`@smoke`)      | Landing → login page (email, password, no Passwordless tab, no forgot-password link); wrong password; forgot-password page; protected pages redirect visitors while `/api/admin/event` answers `401` JSON (A4); each role logs in, lands on its dashboard, is bounced from the other three areas, signs out; the admin sees five tabs, the super admin two; the five admin tabs fit at 375 px (H2)                                                                                                                                                                                                                                                           |
| `auth/signup.spec.ts`                      | Participant (2 steps) and judge (3 steps, picks the organization) sign-up with a password; the accounts are removed afterwards                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `admin/event-lifecycle.spec.ts` (`@smoke`) | Create with the runbook values → edit → `setup → open → active → completed`; delete refused when not `setup` (UI disabled, `400 INVALID_STATUS` from the API); `PUT` without `status`, `description` or `maxTeamSize` leaves them alone (C12); a bad team size and `POST { status: 'active' }` are refused (C13); `completed → setup` refused; walk back and delete                                                                                                                                                                                                                                                                                         |
| `admin/criteria.spec.ts`                   | The four runbook criteria with the weight notice; duplicate name and min ≥ max refused; a weight past 100 refused; keyboard reorder persists across reload; editing locked when `active`; the API refuses PUT, DELETE, POST and reorder with `400 INVALID_STATUS` while `active` and allows PUT again in `open` (H10)                                                                                                                                                                                                                                                                                                                                       |
| `admin/teams.spec.ts`                      | The four runbook teams with award types (Gamma's name has a quote and a comma); duplicate name message; reorder persists; the API refuses a team delete while `active` and the scores stay, allowed again in `open` (H10); ten rounds of two team creates and two criteria creates at once all answer 201 with distinct orders (H12); 25 teams × 20 alternating reorders through the API all answer 200 (H7)                                                                                                                                                                                                                                                |
| `admin/judge-assignment.spec.ts`           | Assign two judges in the dialog; judge 1 sees and opens the event, judge 3 does not; unassign judge 2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `admin/invitations.spec.ts`                | Invite Users → link (no email) → fresh context sets a password → `/judge` with the membership; link single-use; an existing judge is sent to login and gains the organization after "Accept invitation"; the old `/invite/<token>/verify` URL lands on the invitation page and `POST /api/invite/validate` answers 404 (H8); a revoked link is refused; sync-users creates a missing profile as a member of the organization (H5)                                                                                                                                                                                                                           |
| `judge/scoring.spec.ts` (`@smoke`)         | `open` event locked out; judge 1 scores the §3 dataset with the auto-save check mark, criteria follow the award type, comment without score refused, sidebar icons; judge 2 independent; upsert; `open` locks everyone out, `active` restores the scores; a score chosen just before leaving or switching team is still saved (E9); at 375 px the team list sits behind the menu, scoring works and dark mode switches (H2); an expired session says so instead of showing an empty list (H9); a judge unassigned while a team is open gets "No active event", loses nothing and saves once re-assigned; the event completed while a team is open refuses the next click, keeps what was saved, and saves again once `active`; a save that never reaches the server shows the error state and a toast, and the same click saves once the network is back (H13) |
| `judge/burst.spec.ts` (`BURST=1`)          | Ten throw-away judges (`qa-burst-judge-01..10@test.com`, created and removed by the spec) sign in through the login form and score ten `both` teams on four criteria at once, one request in flight per judge (400 saves); every response 200, p95 under 2,000 ms, every team Judge Count 10 / Total Scores 40 and the three modes equal to `lib/results.ts`; prints the timings; skipped unless `BURST=1` is set; Chromium only                                                                                                                                                                                                                           |
| `admin/results.spec.ts`                    | The §3 dataset through the judge API: API and Results tab match §3.1 in Total, Average and Weighted; summary cards 14 / 3 / 2 / 88 %; award-type filter; the export button downloads; the rankings and matrix CSVs parse and match with Gamma escaped; M1–M4; M5 puts a Tie badge on Alpha and Beta in Total and Average and `yes` in the CSV's `Tied` column (F10); the comments export lists every counted score with the E4 comment escaped and a `=QA-Formula` name prefixed in every CSV (F11); a non-applicable score row counts nowhere; a completed event still serves the three exports                                                           |
| `participant/teams.spec.ts`                | `setup` event invisible; logged-out deep link returns after login; register; create (join code format); duplicate name; wrong code; join; full team; rename; regenerate (old code dead); leave as member and creator; creator transfer; the creator removes a member who can join again, nobody else can (D11); the admin Teams tab shows an admin-created team's join code with a copy button and a participant joins with it (D12); two creates at once; two participants taking the last seat at once (one 201, one `TEAM_FULL`); two creates with the same name at once (one 201, one `DUPLICATE_TEAM_NAME`); lock banner when `active`                 |
| `super-admin/organizations.spec.ts`        | Create an organization; invite an admin who accepts with a password and lands on the new organization's dashboard; change a user's role; list users                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `runbook/full-pass.spec.ts` (`RUNBOOK=1`)  | The verification runbook Phase A–H as one continuous pass with the §3 dataset, the three CSVs, M1–M5, C12/C13, D11/D12, E9, F10/F11, H6–H12 (role guard, reorder stress, old verify URL, expired session, the status guards for teams and criteria while `active`, the super admin refused to delete a scored judge, two admin creates at once), an invitation link, sync-users, and the §6 row-count check back to baseline; skipped unless `RUNBOOK=1` is set                                                                                                                                                                                             |

### Manual verification

`documents/2026/4-VERIFICATION-RUNBOOK.md` Part II is the script for the manual pass on the test database and for the production dry run with a throw-away `QA-` event; its §3 dataset is the same one the results specs assert. Part III of the same file is the event-day guide. `documents/` is an internal working folder and is not in the repository.

## Continuous integration

Five workflows run on every pull request:

- `lint-and-format.yml` — ESLint and Prettier
- `typecheck.yml` — `tsc --noEmit`
- `unit-tests.yml` — Vitest
- `build.yml` — `npm run build`, so type and lint errors cannot deploy
- `playwright.yml` — builds the CI database from scratch (`npm run db:setup:seed`, `npm run db:update`), starts `npm run dev`, waits for port 3000, runs `npx playwright test` (all three browser projects); uploads `playwright-report/` and `server.log` on failure (kept 3 days)

## License

See `LICENSE`.
