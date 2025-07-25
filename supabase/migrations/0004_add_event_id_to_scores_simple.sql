-- Add event_id column to scores table for multi-event support
-- Simplified version without complex check constraints

-- Step 1: Add event_id column (nullable initially to allow population)
ALTER TABLE "scores" ADD COLUMN "event_id" uuid;

-- Step 2: Populate event_id from teams table (every score must have a valid team_id)
UPDATE "scores" 
SET "event_id" = "teams"."event_id"
FROM "teams"
WHERE "scores"."team_id" = "teams"."id";

-- Step 3: Make event_id NOT NULL (all existing scores should now have event_id)
ALTER TABLE "scores" ALTER COLUMN "event_id" SET NOT NULL;

-- Step 4: Add foreign key constraint to events table
ALTER TABLE "scores" ADD CONSTRAINT "scores_event_id_events_id_fk" 
FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;

-- Step 5: Update indexes to include event_id for better query performance
-- Drop old indexes if they exist
DROP INDEX IF EXISTS "idx_scores_judge_team";
DROP INDEX IF EXISTS "idx_scores_team_criterion";

-- Create new indexes with event_id
CREATE INDEX "idx_scores_event_judge_team" ON "scores" USING btree ("event_id", "judge_id", "team_id");
CREATE INDEX "idx_scores_event_team_criterion" ON "scores" USING btree ("event_id", "team_id", "criterion_id");
CREATE INDEX "idx_scores_judge_event" ON "scores" USING btree ("judge_id", "event_id");