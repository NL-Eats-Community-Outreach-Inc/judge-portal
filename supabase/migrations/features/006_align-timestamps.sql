-- ================================================================
-- FEATURE: Align timestamp defaults and event_judges.assigned_at
-- Description: Production was built by the archived migrations, which left
--              created_at/updated_at on five tables defaulting to now() and
--              event_judges.assigned_at nullable. Sets the defaults and the
--              NOT NULL that consolidated_setup.sql and lib/db/schema.ts declare.
-- Dependencies: consolidated_setup.sql
-- Idempotent; safe to re-run.
-- ================================================================

ALTER TABLE public.users    ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.users    ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.events   ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.events   ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.teams    ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.teams    ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.criteria ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.criteria ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.scores   ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.scores   ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());

-- Backfill so SET NOT NULL can never fail on an old row (no such rows exist today).
UPDATE public.event_judges SET assigned_at = timezone('utc'::text, now()) WHERE assigned_at IS NULL;
ALTER TABLE public.event_judges ALTER COLUMN assigned_at SET NOT NULL;
