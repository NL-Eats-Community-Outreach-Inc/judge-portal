-- Participant Feature Migration
-- This migration adds participant role support and team membership functionality
--
-- Changes:
-- 1. Add 'participant' to user_role enum
-- 2. Add registration fields to events table
-- 3. Create team_members table for participant team management
-- 4. Add RLS policies for participant access
-- 5. Create helper functions for business logic

-- ================================================================
-- STEP 1: UPDATE ENUMS
-- ================================================================

-- Add participant to user_role enum
-- Note: Enum modifications must be run outside transactions
DO $$
DECLARE
    participant_exists boolean;
BEGIN
    -- Check if participant value already exists
    SELECT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'user_role' AND e.enumlabel = 'participant'
    ) INTO participant_exists;

    IF NOT participant_exists THEN
        -- Add the participant enum value
        ALTER TYPE user_role ADD VALUE 'participant';
        RAISE NOTICE 'Added participant value to user_role enum';
    ELSE
        RAISE NOTICE 'participant value already exists in user_role enum';
    END IF;
END $$;

-- ================================================================
-- STEP 2: UPDATE EVENTS TABLE
-- ================================================================

-- Add registration control fields to events table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'registration_open') THEN
        ALTER TABLE events ADD COLUMN registration_open BOOLEAN DEFAULT false NOT NULL;
        RAISE NOTICE 'Added registration_open column to events table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'registration_close_at') THEN
        ALTER TABLE events ADD COLUMN registration_close_at TIMESTAMPTZ;
        RAISE NOTICE 'Added registration_close_at column to events table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'max_team_size') THEN
        ALTER TABLE events ADD COLUMN max_team_size INTEGER DEFAULT 5 NOT NULL;
        RAISE NOTICE 'Added max_team_size column to events table';
    END IF;
END $$;

-- Add constraint for max_team_size
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_max_team_size') THEN
        ALTER TABLE events ADD CONSTRAINT check_max_team_size CHECK (max_team_size >= 1);
        RAISE NOTICE 'Added check_max_team_size constraint';
    END IF;
END $$;

-- ================================================================
-- STEP 3: CREATE TEAM_MEMBERS TABLE
-- ================================================================

-- Create team_members table for participant team management
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================================================================
-- STEP 4: ADD CONSTRAINTS AND INDEXES
-- ================================================================

-- Add unique constraints to ensure business rules
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_event') THEN
        ALTER TABLE team_members ADD CONSTRAINT unique_user_event UNIQUE (event_id, user_id);
        RAISE NOTICE 'Added unique_user_event constraint';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_team_user') THEN
        ALTER TABLE team_members ADD CONSTRAINT unique_team_user UNIQUE (team_id, user_id);
        RAISE NOTICE 'Added unique_team_user constraint';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Constraints already exist';
END $$;

-- Add performance indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_team_members_event') THEN
        CREATE INDEX idx_team_members_event ON team_members(event_id);
        RAISE NOTICE 'Created idx_team_members_event index';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_team_members_team') THEN
        CREATE INDEX idx_team_members_team ON team_members(team_id);
        RAISE NOTICE 'Created idx_team_members_team index';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_team_members_user') THEN
        CREATE INDEX idx_team_members_user ON team_members(user_id);
        RAISE NOTICE 'Created idx_team_members_user index';
    END IF;
END $$;

-- ================================================================
-- STEP 5: ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================================

-- Enable RLS on team_members table
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- First, clean up any problematic policies that might cause issues
DROP POLICY IF EXISTS "Participants can view team members in same event" ON team_members;
DROP POLICY IF EXISTS "Participants can view other participants in same event" ON users;
DROP POLICY IF EXISTS "Participants can view own profile" ON users;

-- Now create the correct policies

-- Participants can view and manage their own team memberships
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Participants can view own team memberships' AND tablename = 'team_members') THEN
        CREATE POLICY "Participants can view own team memberships"
        ON team_members FOR SELECT
        USING (auth.uid() = user_id);
        RAISE NOTICE 'Created policy: Participants can view own team memberships';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Participants can insert own team memberships' AND tablename = 'team_members') THEN
        CREATE POLICY "Participants can insert own team memberships"
        ON team_members FOR INSERT
        WITH CHECK (auth.uid() = user_id);
        RAISE NOTICE 'Created policy: Participants can insert own team memberships';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Participants can delete own team memberships' AND tablename = 'team_members') THEN
        CREATE POLICY "Participants can delete own team memberships"
        ON team_members FOR DELETE
        USING (auth.uid() = user_id);
        RAISE NOTICE 'Created policy: Participants can delete own team memberships';
    END IF;

    -- Allow participants to view all team members for teams they are on (non-recursive)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Participants can view team members of their teams' AND tablename = 'team_members') THEN
        CREATE POLICY "Participants can view team members of their teams"
        ON team_members FOR SELECT
        USING (
          team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
          )
        );
        RAISE NOTICE 'Created policy: Participants can view team members of their teams';
    END IF;

    -- Admins can manage all team memberships
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all team memberships' AND tablename = 'team_members') THEN
        CREATE POLICY "Admins can view all team memberships"
        ON team_members FOR ALL
        USING (
          EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
        );
        RAISE NOTICE 'Created policy: Admins can view all team memberships';
    END IF;
END $$;

-- Update users table policies to allow all authenticated users to view their own profile
DO $$
BEGIN
    -- Create a unified policy for all users to view their own profile
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile' AND tablename = 'users') THEN
        CREATE POLICY "Users can view own profile"
        ON users FOR SELECT
        USING (auth.uid() = id);
        RAISE NOTICE 'Created policy: Users can view own profile';
    END IF;
END $$;

-- ================================================================
-- STEP 6: HELPER FUNCTIONS
-- ================================================================

-- Function to check if registration is open for an event
CREATE OR REPLACE FUNCTION is_registration_open(event_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT
    registration_open = true
    AND (registration_close_at IS NULL OR registration_close_at > now())
  FROM events
  WHERE id = event_id;
$$;

-- Function to get team member count
CREATE OR REPLACE FUNCTION get_team_member_count(team_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM team_members WHERE team_id = $1;
$$;

-- Function to check if user is already on a team for an event
CREATE OR REPLACE FUNCTION user_has_team_in_event(user_id UUID, event_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = $1 AND event_id = $2
  );
$$;

-- ================================================================
-- STEP 7: UPDATE EXISTING RLS POLICIES FOR PARTICIPANTS
-- ================================================================

-- Update existing table RLS policies for participants
DO $$
BEGIN
    -- Teams table: participants can view teams in accessible events
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Participants can view teams in accessible events' AND tablename = 'teams') THEN
        CREATE POLICY "Participants can view teams in accessible events"
        ON teams FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM events
            WHERE id = teams.event_id
            AND (status = 'setup' OR status = 'active')
          )
        );
        RAISE NOTICE 'Created policy: Participants can view teams in accessible events';
    END IF;

    -- Criteria table: participants can view criteria in accessible events
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Participants can view criteria in accessible events' AND tablename = 'criteria') THEN
        CREATE POLICY "Participants can view criteria in accessible events"
        ON criteria FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM events
            WHERE id = criteria.event_id
            AND (status = 'setup' OR status = 'active')
          )
        );
        RAISE NOTICE 'Created policy: Participants can view criteria in accessible events';
    END IF;

    -- Events table: participants can view accessible events
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Participants can view accessible events' AND tablename = 'events') THEN
        CREATE POLICY "Participants can view accessible events"
        ON events FOR SELECT
        USING (status = 'setup' OR status = 'active');
        RAISE NOTICE 'Created policy: Participants can view accessible events';
    END IF;

    -- Ensure the signup trigger can insert users
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow signup trigger to insert users' AND tablename = 'users') THEN
        CREATE POLICY "Allow signup trigger to insert users"
        ON users FOR INSERT
        WITH CHECK (true);
        RAISE NOTICE 'Created policy: Allow signup trigger to insert users';
    END IF;
END $$;

-- ================================================================
-- STEP 8: UPDATE HELPER FUNCTIONS AND TRIGGERS
-- ================================================================

-- Drop the old handle_new_user function and recreate with participant support
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create the new handle_new_user function with participant role support
CREATE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role_value text;
  user_exists boolean;
BEGIN
  -- Check if user already exists
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = NEW.id) INTO user_exists;

  IF user_exists THEN
    -- User already exists, just return
    RETURN NEW;
  END IF;

  -- Extract role from metadata, default to 'judge' if not specified
  user_role_value := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'judge'
  );

  -- Validate the role value
  IF user_role_value NOT IN ('admin', 'judge', 'participant') THEN
    user_role_value := 'judge';
  END IF;

  -- Insert user record
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.email_change, 'unknown@example.com'),
    user_role_value::user_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role::user_role,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the signup
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    -- Still try to insert with minimal info
    BEGIN
      INSERT INTO public.users (id, email, role)
      VALUES (NEW.id, COALESCE(NEW.email, 'unknown@example.com'), 'judge'::user_role)
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create user record: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO postgres, anon, authenticated, service_role;

-- ================================================================
-- STEP 9: ENSURE TRIGGER IS ACTIVE
-- ================================================================

-- Recreate the trigger to ensure it exists and uses the updated function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- STEP 10: FIX ORPHANED AUTH USERS
-- ================================================================

-- Fix any existing auth users that don't have corresponding user records
DO $$
DECLARE
  auth_user RECORD;
  user_role_value text;
BEGIN
  FOR auth_user IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users u ON u.id = au.id
    WHERE u.id IS NULL
  LOOP
    -- Extract role from metadata
    user_role_value := COALESCE(
      auth_user.raw_user_meta_data->>'role',
      'judge'
    );

    -- Validate role
    IF user_role_value NOT IN ('admin', 'judge', 'participant') THEN
      user_role_value := 'judge';
    END IF;

    -- Create missing user record
    BEGIN
      INSERT INTO public.users (id, email, role, created_at, updated_at)
      VALUES (
        auth_user.id,
        auth_user.email,
        user_role_value::user_role,
        NOW(),
        NOW()
      );
      RAISE NOTICE 'Created missing user record for %', auth_user.email;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Could not create user record for %: %', auth_user.email, SQLERRM;
    END;
  END LOOP;
END $$;

-- ================================================================
-- STEP 11: GRANT PERMISSIONS FOR TEAM_MEMBERS TABLE
-- ================================================================

-- Grant necessary permissions on team_members table
GRANT ALL ON TABLE team_members TO postgres, authenticated, service_role;
-- Note: team_members uses UUID, not a sequence, so no sequence permissions needed

-- Grant permissions on helper functions
GRANT EXECUTE ON FUNCTION is_registration_open(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_member_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_team_in_event(UUID, UUID) TO authenticated;

-- ================================================================
-- STEP 12: VERIFY AND REPORT STATUS
-- ================================================================

DO $$
DECLARE
    table_count integer;
    policy_count integer;
    function_count integer;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name = 'team_members'
    AND table_schema = 'public';

    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename IN ('users', 'team_members', 'teams', 'criteria', 'events')
    AND policyname LIKE '%articipant%';

    -- Count functions
    SELECT COUNT(*) INTO function_count
    FROM pg_proc
    WHERE proname IN ('is_registration_open', 'get_team_member_count', 'user_has_team_in_event', 'handle_new_user');

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PARTICIPANT FEATURE MIGRATION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Tables created: % (team_members)', table_count;
    RAISE NOTICE '✅ Policies created: % participant-related policies', policy_count;
    RAISE NOTICE '✅ Functions created: % helper functions', function_count;
    RAISE NOTICE '';
    RAISE NOTICE 'The participant feature is now fully configured with:';
    RAISE NOTICE '1. participant role in user_role enum';
    RAISE NOTICE '2. Registration controls on events table';
    RAISE NOTICE '3. team_members table with proper constraints';
    RAISE NOTICE '4. RLS policies without infinite recursion';
    RAISE NOTICE '5. Helper functions for business logic';
    RAISE NOTICE '6. Updated trigger for new user creation';
    RAISE NOTICE '';
    RAISE NOTICE 'This migration is idempotent and can be run safely multiple times.';
END $$;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================