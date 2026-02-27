-- ================================================================
-- FEATURE: Challenges table
-- Description: Create a new table in Supabase to store public-facing challenge data.
--              This serves as the bridge between internal "Events" and the external "LearnWorlds" display.
-- Dependencies: consolidated_setup.sql
-- ================================================================

-- ================================================================
-- STEP 1: CREATE ENUM TYPES
-- ================================================================

-- Challenge type enum
CREATE TYPE challenge_type AS ENUM ('local', 'global');

-- Challenge status enum
CREATE TYPE challenge_status AS ENUM ('draft', 'open', 'closed', 'judging', 'completed');


-- ================================================================
-- STEP 2: CREATE TABLES
-- ================================================================
CREATE TABLE IF NOT EXISTS challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  cover_image_url TEXT,
  challenge_type challenge_type NOT NULL,
  tags TEXT[],
  prize_amount NUMERIC,
  deadline TIMESTAMP WITH TIME ZONE,
  max_teams INTEGER,
  status challenge_status DEFAULT 'draft' NOT NULL,
  participant_signup_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================================================================
-- STEP 3: CREATE FUNCTIONS
-- ================================================================

-- ================================================================
-- STEP 4: CREATE TRIGGERS
-- ================================================================

-- ================================================================
-- STEP 5: CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Challenges indexes
CREATE INDEX IF NOT EXISTS idx_challenges_event_id ON challenges(event_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);

-- ================================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ================================================================

-- Enable RLS on challenges table for proper security
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- STEP 7: CREATE RLS POLICIES
-- ================================================================

-- Challenges table policies
CREATE POLICY "Admins can manage challenges"
  ON challenges FOR ALL
  USING ((SELECT role FROM check_user_role(auth.uid())) = 'admin'::user_role);

CREATE POLICY "Public can view challenges table"
  ON challenges FOR SELECT
  USING (true);

-- ================================================================
-- END
-- ================================================================