-- ================================================================
-- FEATURE: Align production and test schemas
-- Description: Makes events.status and users.role NOT NULL (no nulls exist),
--              drops a hand-made duplicate policy that only production has,
--              and gives the scores policy the stricter production definition.
-- Dependencies: consolidated_setup.sql, 002_multi-tenant-participants.sql
-- Idempotent; safe to re-run.
-- ================================================================

ALTER TABLE public.events ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.users  ALTER COLUMN role   SET NOT NULL;

-- Hand-made duplicate of "Users can view their own record"; only production has it.
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

DROP POLICY IF EXISTS "Judges can manage their own scores" ON public.scores;
CREATE POLICY "Judges can manage their own scores" ON public.scores FOR ALL
  USING (judge_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'judge'::user_role));
