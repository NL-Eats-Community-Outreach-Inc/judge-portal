-- ================================================================
-- FEATURE MIGRATION: submission AI scores event linkage
-- Description: Adds event linkage and duplicate prevention for AI
--              pre-screening score records.
-- Dependencies: events and teams tables
-- ================================================================

CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  submission_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(event_id, team_id)
);

CREATE TABLE IF NOT EXISTS submission_ai_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE submission_ai_scores
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;

UPDATE submission_ai_scores sais
SET event_id = s.event_id
FROM submissions s
WHERE sais.submission_id = s.id
  AND sais.event_id IS NULL;

ALTER TABLE submission_ai_scores
  ALTER COLUMN event_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS submission_ai_scores_submission_unique
  ON submission_ai_scores(submission_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_submission_ai_scores_score_range'
  ) THEN
    ALTER TABLE submission_ai_scores
      ADD CONSTRAINT check_submission_ai_scores_score_range CHECK (score >= 0 AND score <= 100);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submission_ai_scores_event
  ON submission_ai_scores(event_id);
