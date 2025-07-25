-- Add check constraint to ensure eventId consistency in scores table
-- This ensures that the eventId in scores matches the eventId of the referenced team

-- Add constraint to ensure scores.eventId matches teams.eventId
ALTER TABLE "scores" ADD CONSTRAINT "scores_event_consistency_check" 
CHECK (
  (SELECT "event_id" FROM "teams" WHERE "teams"."id" = "scores"."team_id") = "scores"."event_id"
);

-- Add constraint to ensure scores.eventId matches criteria.eventId  
ALTER TABLE "scores" ADD CONSTRAINT "scores_criteria_event_consistency_check" 
CHECK (
  (SELECT "event_id" FROM "criteria" WHERE "criteria"."id" = "scores"."criterion_id") = "scores"."event_id"
);

-- Create index to improve performance of constraint checks
CREATE INDEX IF NOT EXISTS "idx_scores_event_consistency" ON "scores" ("event_id", "team_id", "criterion_id");