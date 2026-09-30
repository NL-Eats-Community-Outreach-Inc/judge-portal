-- ================================================================
-- FEATURE: Remove the LearnWorlds integration
-- Description: Drops the competitions, mentor directory, ingestion and
--              recommendation objects. Every one of these tables was empty
--              in production when this file was written (2026-09-20).
-- Dependencies: none. Idempotent; safe to re-run.
-- ================================================================

-- DROP TRIGGER IF EXISTS still needs the table to exist, so both are guarded
-- for databases that never had the LearnWorlds tables (a fresh rebuild).
DO $$ BEGIN
  IF to_regclass('public.competitions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_set_competition_participant_signup_url ON public.competitions;
  END IF;
  IF to_regclass('public.mentor_profiles') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS mentor_profiles_updated_at ON public.mentor_profiles;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.set_competition_participant_signup_url();
DROP FUNCTION IF EXISTS public.update_mentor_profiles_updated_at();

DROP TABLE IF EXISTS public.recommendation_outcomes;
DROP TABLE IF EXISTS public.recommendation_impressions;
DROP TABLE IF EXISTS public.recommendation_feedback;
DROP TABLE IF EXISTS public.learner_recommendations;
DROP TABLE IF EXISTS public.learner_item_events;
DROP TABLE IF EXISTS public.ml_training_examples;
DROP TABLE IF EXISTS public.model_registry;
DROP TABLE IF EXISTS public.learning_items;
DROP TABLE IF EXISTS public.learner_progress;
DROP TABLE IF EXISTS public.learnworlds_raw_payloads;
DROP TABLE IF EXISTS public.learnworlds_sync_runs;
DROP TABLE IF EXISTS public.mentor_profiles;
DROP TABLE IF EXISTS public.competitions;
