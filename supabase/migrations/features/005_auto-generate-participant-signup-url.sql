-- ================================================================
-- FEATURE: Auto-generate participant signup URL
-- Description: Trigger to automatically populate participant_signup_url 
--              on the competitions table using the event_id.
-- Dependencies: 003_competitions.sql
-- ================================================================

-- Trigger function to set participant_signup_url based on event_id on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.set_competition_participant_signup_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_url text;
BEGIN
  base_url := current_setting('app.settings.participant_base_url', true);

  -- Error handling for missing base_url configuration
  IF base_url IS NULL OR base_url = '' THEN
    RAISE EXCEPTION 'Database Configuration Error: "app.settings.participant_base_url" is missing.';
  END IF;

  -- URL generation
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.event_id IS DISTINCT FROM NEW.event_id)) THEN
    IF NEW.event_id IS NULL THEN
      NEW.participant_signup_url := NULL;
    ELSE
      NEW.participant_signup_url := base_url || '/participant/event/' || NEW.event_id::text;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on competitions table to call the function on insert or update of event_id
DROP TRIGGER IF EXISTS trg_set_competition_participant_signup_url ON public.competitions;
CREATE TRIGGER trg_set_competition_participant_signup_url
  BEFORE INSERT OR UPDATE OF event_id ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.set_competition_participant_signup_url();

-- Backfill existing rows
DO $$
DECLARE
  base_url text;
BEGIN
  base_url := current_setting('app.settings.participant_base_url', true);

  -- Error handling for missing base_url configuration
  IF base_url IS NULL OR base_url = '' THEN
    RAISE EXCEPTION 'Database Configuration Error: "app.settings.participant_base_url" is missing.';
  END IF;

  UPDATE public.competitions
  SET participant_signup_url = base_url || '/participant/event/' || event_id::text
  WHERE event_id IS NOT NULL
    AND (participant_signup_url IS NULL OR participant_signup_url != (base_url || '/participant/event/' || event_id::text));
END $$;

-- Success Message
DO $$
BEGIN
  RAISE NOTICE 'Feature "Auto-generate participant signup URL" applied successfully.';
  RAISE NOTICE 'Trigger "trg_set_competition_participant_signup_url" created and existing rows backfilled.';
  RAISE NOTICE 'Competitions will now have participant_signup_url auto-generated based on event_id.';
END $$;