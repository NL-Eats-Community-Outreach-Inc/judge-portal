-- Enable Realtime and RLS for all tables to fix subscription errors
-- This fixes the "Unable to subscribe to changes" errors

-- Step 1: Enable RLS on all tables (except users which already has it)
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "criteria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scores" ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policies for judges to read necessary tables

-- Judges can view all events (needed for event status checks)
CREATE POLICY "Judges can view all events" ON "events"
FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'judge'::user_role
));

-- Judges can view teams for active events
CREATE POLICY "Judges can view teams" ON "teams"  
FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'judge'::user_role
));

-- Judges can view criteria for active events
CREATE POLICY "Judges can view criteria" ON "criteria"
FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'judge'::user_role
));

-- Judges can manage their own scores
CREATE POLICY "Judges can manage their own scores" ON "scores"
FOR ALL TO public
USING (
  judge_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'judge'::user_role
  )
);

-- Step 3: Enable Realtime for all tables
-- This creates the publication needed for Realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE criteria;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
ALTER PUBLICATION supabase_realtime ADD TABLE users;