-- ================================================================
-- FEATURE: Auto-generate participant signup URL
-- Description: Trigger to automatically populate participant_signup_url 
--              on the competitions table using the event_id.
-- Dependencies: 003_competitions.sql
-- ================================================================

-- Trigger function to set participant_signup_url based on event_id on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.set_competition_participant_signup_url()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.event_id IS DISTINCT FROM new.event_id)) THEN
    new.participant_signup_url := 'https://judgeportal.com/participant/challenges/' || new.event_id::text;
  END IF;
  RETURN new;
EXCEPTION 
  WHEN OTHERS THEN
    RAISE WARNING 'Error in set_competition_participant_signup_url for %',  SQLERRM;
    RETURN new;
END;
$$;

-- Create trigger on competitions table to call the function on insert or update of event_id
DROP TRIGGER IF EXISTS trg_set_competition_participant_signup_url ON public.competitions;
CREATE TRIGGER trg_set_competition_participant_signup_url
  BEFORE INSERT OR UPDATE OF event_id ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.set_competition_participant_signup_url();

-- Backfill existing rows
DO $$
BEGIN
  UPDATE public.competitions
  SET participant_signup_url = 'https://judgeportal.com/participant/challenges/' || event_id::text
  WHERE event_id IS NOT NULL
    AND (participant_signup_url IS NULL OR participant_signup_url != ('https://judgeportal.com/participant/challenges/' || event_id::text));
END $$;

-- Success Message
DO $$
BEGIN
  RAISE NOTICE 'Feature "Auto-generate participant signup URL" applied successfully.';
  RAISE NOTICE 'Trigger "trg_set_competition_participant_signup_url" created and existing rows backfilled.';
  RAISE NOTICE 'Competitions will now have participant_signup_url auto-generated based on event_id.';
END $$;