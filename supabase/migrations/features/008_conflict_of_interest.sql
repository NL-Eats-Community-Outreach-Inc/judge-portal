
-- Remove the legacy conflict-of-interest field from scores.
ALTER TABLE public.scores
  DROP COLUMN IF EXISTS conflict_of_interest;

-- Create the separate conflict declaration table.
CREATE TABLE IF NOT EXISTS public.judge_team_conflicts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  has_conflict BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_judge_team_conflict
    UNIQUE (event_id, judge_id, team_id)
);

-- Enable RLS immediately.
ALTER TABLE public.judge_team_conflicts
  ENABLE ROW LEVEL SECURITY;

-- Indexes.
CREATE INDEX IF NOT EXISTS idx_judge_team_conflicts_event
  ON public.judge_team_conflicts(event_id);

CREATE INDEX IF NOT EXISTS idx_judge_team_conflicts_judge
  ON public.judge_team_conflicts(judge_id);

CREATE INDEX IF NOT EXISTS idx_judge_team_conflicts_team
  ON public.judge_team_conflicts(team_id);
