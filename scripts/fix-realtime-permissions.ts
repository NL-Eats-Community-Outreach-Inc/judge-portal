#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'

// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

async function showRealtimeInstructions() {
  console.log(`
🔧 Realtime Configuration Required

The Realtime subscription errors indicate that:
1. RLS (Row Level Security) is not enabled for most tables
2. Realtime publication is not configured for the tables

To fix this, please run the following SQL commands in your Supabase SQL Editor:

======================================================================

-- 1. Enable RLS on all tables
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;  
ALTER TABLE "criteria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scores" ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for judges to read tables
CREATE POLICY "Judges can view all events" ON "events"
FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'judge'::user_role
));

CREATE POLICY "Judges can view teams" ON "teams"  
FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'judge'::user_role
));

CREATE POLICY "Judges can view criteria" ON "criteria"
FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'judge'::user_role
));

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

-- 3. Enable Realtime for all tables  
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE criteria;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
ALTER PUBLICATION supabase_realtime ADD TABLE users;

======================================================================

After running these commands in Supabase SQL Editor, the Realtime subscriptions should work correctly.

`)
}

showRealtimeInstructions()