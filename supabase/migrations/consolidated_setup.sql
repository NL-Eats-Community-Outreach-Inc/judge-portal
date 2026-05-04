-- JudgePortal Complete Database Setup
-- This is a consolidated migration that sets up the entire database from scratch
-- It combines all individual migrations into one comprehensive setup file

-- ================================================================
-- STEP 1: CREATE ENUM TYPES
-- ================================================================

-- Event status enum
CREATE TYPE event_status AS ENUM ('setup', 'open', 'active', 'completed');

-- User role enum
CREATE TYPE user_role AS ENUM ('admin', 'judge');

-- Criteria category enum
CREATE TYPE criteria_category AS ENUM ('technical', 'business');

-- Team award type enum
CREATE TYPE team_award_type AS ENUM ('technical', 'business', 'both');

-- ================================================================
-- STEP 2: CREATE TABLES
-- ================================================================

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status event_status DEFAULT 'setup' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Users table (synced with auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  role user_role DEFAULT 'judge' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  demo_url TEXT,
  repo_url TEXT,
  presentation_order INTEGER NOT NULL,
  award_type team_award_type DEFAULT 'both' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(event_id, presentation_order),
  UNIQUE(event_id, name),
  UNIQUE(event_id, id)
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  is_creator BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, participant_id)
);

-- Criteria table
CREATE TABLE IF NOT EXISTS criteria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  min_score INTEGER DEFAULT 1 NOT NULL,
  max_score INTEGER DEFAULT 10 NOT NULL,
  display_order INTEGER NOT NULL,
  weight INTEGER DEFAULT 20 NOT NULL,
  category criteria_category DEFAULT 'technical' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(event_id, display_order),
  UNIQUE(event_id, name),
  CHECK (min_score < max_score),
  CHECK (weight >= 0 AND weight <= 100)
);

-- Scores table
CREATE TABLE IF NOT EXISTS scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  judge_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  criterion_id UUID REFERENCES criteria(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(judge_id, team_id, criterion_id)
);

-- Event judges assignment table
CREATE TABLE IF NOT EXISTS event_judges (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  judge_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (event_id, judge_id)
);

-- Submission Text Table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  event_id UUID NOT NULL,
  team_id UUID NOT NULL,

  submission_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Prevent duplicate submissions per team per event
  UNIQUE(event_id, team_id),

  -- Normal FK to events
  FOREIGN KEY (event_id)
    REFERENCES events(id)
    ON DELETE CASCADE,

  -- Enforces that team belongs to the same event
  FOREIGN KEY (event_id, team_id)
    REFERENCES teams(event_id, id)
    ON DELETE CASCADE
);

-- Submission AI Prescreening Table
CREATE TABLE IF NOT EXISTS submission_ai_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(submission_id)
);

-- ================================================================
-- STEP 3: CREATE FUNCTIONS
-- ================================================================

-- Function to check user role (for RLS policies and middleware)
CREATE OR REPLACE FUNCTION check_user_role(user_id UUID)
RETURNS TABLE(role user_role)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.role
  FROM users u
  WHERE u.id = user_id
  LIMIT 1;
$$;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION check_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_role(uuid) TO anon;

-- Function to handle new user creation (sync with auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (new.id, new.email, 'judge')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- STEP 4: CREATE TRIGGERS
-- ================================================================

-- Trigger to sync auth.users with public.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- STEP 5: CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Criteria indexes
CREATE INDEX IF NOT EXISTS idx_criteria_event_order ON criteria(event_id, display_order);
CREATE INDEX IF NOT EXISTS idx_criteria_category ON criteria(category);

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_event_order ON teams(event_id, presentation_order);
CREATE INDEX IF NOT EXISTS idx_teams_award_type ON teams(award_type);

-- Scores indexes
CREATE INDEX IF NOT EXISTS idx_scores_event_judge_team ON scores(event_id, judge_id, team_id);
CREATE INDEX IF NOT EXISTS idx_scores_event_team_criterion ON scores(event_id, team_id, criterion_id);
CREATE INDEX IF NOT EXISTS idx_scores_judge_event ON scores(judge_id, event_id);

-- Event judges indexes
CREATE INDEX IF NOT EXISTS idx_event_judges_event ON event_judges(event_id);
CREATE INDEX IF NOT EXISTS idx_event_judges_judge ON event_judges(judge_id);

-- AI Pre-screen Score indexes
CREATE INDEX IF NOT EXISTS idx_submissions_event_team ON submissions(event_id, team_id);
CREATE INDEX IF NOT EXISTS idx_submission_ai_scores_submission ON submission_ai_scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_ai_scores_event ON submission_ai_scores(event_id);

-- ================================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ================================================================

-- Enable RLS on all tables for proper security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_ai_scores ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- STEP 7: CREATE RLS POLICIES
-- ================================================================

-- Users table policies
CREATE POLICY "Users can view their own record" 
  ON users FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON users FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" 
  ON users FOR SELECT 
  USING ((SELECT role FROM check_user_role(auth.uid())) = 'admin'::user_role);

CREATE POLICY "Admins can update users" 
  ON users FOR UPDATE 
  USING ((SELECT role FROM check_user_role(auth.uid())) = 'admin'::user_role);

-- Event judges table policies
CREATE POLICY "Judges can view own assignments" 
  ON event_judges FOR SELECT 
  USING (auth.uid() = judge_id);

CREATE POLICY "Admins can view all assignments" 
  ON event_judges FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert assignments" 
  ON event_judges FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete assignments" 
  ON event_judges FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Scores table policies for judges
CREATE POLICY "Judges can view own scores" 
  ON scores FOR SELECT 
  USING (auth.uid() = judge_id);

CREATE POLICY "Judges can insert own scores" 
  ON scores FOR INSERT 
  WITH CHECK (auth.uid() = judge_id);

CREATE POLICY "Judges can update own scores" 
  ON scores FOR UPDATE 
  USING (auth.uid() = judge_id);

CREATE POLICY "Judges can manage their own scores" 
  ON scores FOR ALL 
  USING (auth.uid() = judge_id);

-- Events table policies  
CREATE POLICY "All authenticated users can view events" 
  ON events FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Judges can view all events" 
  ON events FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'judge'::user_role
    )
  );

-- Teams table policies
CREATE POLICY "All authenticated users can view teams" 
  ON teams FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Judges can view teams" 
  ON teams FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'judge'::user_role
    )
  );

-- Criteria table policies
CREATE POLICY "All authenticated users can view criteria" 
  ON criteria FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Judges can view criteria" 
  ON criteria FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'judge'::user_role
    )
  );

-- Admin policies
CREATE POLICY "Admins can manage criteria" 
  ON criteria FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'::user_role
    )
  );

CREATE POLICY "Admins can manage events" 
  ON events FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'::user_role
    )
  );

CREATE POLICY "Admins can view all scores" 
  ON scores FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'::user_role
    )
  );

CREATE POLICY "Admins can manage teams" 
  ON teams FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'::user_role
    )
  );

-- submissions table policy
CREATE POLICY "team members can insert submissions"
  ON submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      JOIN events e ON e.id = t.event_id
      WHERE tm.team_id = submissions.team_id
        AND tm.participant_id = auth.uid()
        AND e.status = 'open'
    )
  );

CREATE POLICY "team members can view submissions"
  ON submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = submissions.team_id
        AND tm.participant_id = auth.uid()
    )
  );

-- submission ai scoring table policy
CREATE POLICY "no client access to ai scores"
  ON submission_ai_scores
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Allow backend/service role to manage submissions during seed and server-side workflows
CREATE POLICY "service role can manage submissions"
  ON submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow backend/service role to manage AI scores during seed and server-side workflows
CREATE POLICY "service role can manage submission ai scores"
  ON submission_ai_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ================================================================
-- STEP 8: SYNC EXISTING AUTH USERS
-- ================================================================

-- Sync any existing auth users that aren't in public.users
INSERT INTO public.users (id, email, role)
SELECT id, email, 'judge'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- STEP 9: POPULATE EVENT_JUDGES FOR EXISTING DATA
-- ================================================================

-- If there are existing scores, ensure judges are assigned to events
INSERT INTO event_judges (event_id, judge_id)
SELECT DISTINCT s.event_id, s.judge_id
FROM scores s
WHERE NOT EXISTS (
  SELECT 1 FROM event_judges ej 
  WHERE ej.event_id = s.event_id AND ej.judge_id = s.judge_id
)
ON CONFLICT (event_id, judge_id) DO NOTHING;

-- ================================================================
-- COMPLETE! Database is now fully configured
-- ================================================================
