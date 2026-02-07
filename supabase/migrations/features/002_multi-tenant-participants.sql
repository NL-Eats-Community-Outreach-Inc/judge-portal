-- ================================================================
-- FEATURE: Multi-Tenant + Participant Team Management
-- Description: Adds organizations, event participants, team members,
--              multi-tenant scoping, and 4-stage event lifecycle
-- Dependencies: consolidated_setup.sql, 001_invite-link.sql
-- ================================================================

-- ================================================================
-- SECTION 1: UPDATE ENUMS
-- ================================================================

-- Add 'open' to event_status enum (before 'active')
DO $$ BEGIN
  ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'open' BEFORE 'active';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add 'super_admin' to user_role enum
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add 'admin' to invitation_role enum
DO $$ BEGIN
  ALTER TYPE invitation_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ================================================================
-- SECTION 2: CREATE NEW TABLES
-- ================================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Event participants (registration junction table)
CREATE TABLE IF NOT EXISTS event_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(event_id, participant_id)
);

-- Team members (team membership junction table)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  is_creator BOOLEAN DEFAULT false NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(team_id, participant_id)
);

-- ================================================================
-- SECTION 3: ADD COLUMNS TO EXISTING TABLES
-- ================================================================

-- events.organization_id (NULLABLE — NOT NULL added in Phase 4)
DO $$ BEGIN
  ALTER TABLE events ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- events.max_team_size
DO $$ BEGIN
  ALTER TABLE events ADD COLUMN max_team_size INTEGER;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- teams.join_code
DO $$ BEGIN
  ALTER TABLE teams ADD COLUMN join_code TEXT UNIQUE;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- users.organization_id (SET NULL on org delete)
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- invitations.organization_id
DO $$ BEGIN
  ALTER TABLE invitations ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- ================================================================
-- SECTION 4: DATA MIGRATION
-- ================================================================

DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Create default organization if it doesn't exist
  INSERT INTO organizations (name, slug, description)
  VALUES (
    'Default Organization',
    'default',
    'Default organization for existing events and users'
  )
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO default_org_id;

  -- If RETURNING didn't work (conflict path), fetch it
  IF default_org_id IS NULL THEN
    SELECT id INTO default_org_id FROM organizations WHERE slug = 'default';
  END IF;

  -- Assign all existing events to default organization
  UPDATE events
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;

  -- Assign all existing admin users to default organization
  UPDATE users
  SET organization_id = default_org_id
  WHERE organization_id IS NULL AND role = 'admin';

  RAISE NOTICE 'Default organization created/found with ID: %', default_org_id;
END $$;

-- ================================================================
-- SECTION 5: CREATE INDEXES
-- ================================================================

-- Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Event participants
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_participant ON event_participants(participant_id);

-- Team members
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_participant ON team_members(participant_id);

-- Foreign key indexes on existing tables
CREATE INDEX IF NOT EXISTS idx_events_organization ON events(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_organization ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_join_code ON teams(join_code);

-- ================================================================
-- SECTION 6: ROW LEVEL SECURITY (new tables only)
-- ================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Organizations: all authenticated users can view
DROP POLICY IF EXISTS "All authenticated users can view organizations" ON organizations;
CREATE POLICY "All authenticated users can view organizations"
  ON organizations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Organizations: admins can manage their own org
-- Use role::text cast to avoid "unsafe use of new enum value" in same transaction
DROP POLICY IF EXISTS "Admins can manage their organization" ON organizations;
CREATE POLICY "Admins can manage their organization"
  ON organizations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role::text IN ('admin', 'super_admin')
      AND users.organization_id = organizations.id
    )
  );

-- Event participants: participants can view their own registrations
DROP POLICY IF EXISTS "Participants can view their own registrations" ON event_participants;
CREATE POLICY "Participants can view their own registrations"
  ON event_participants FOR SELECT
  USING (auth.uid() = participant_id);

-- Event participants: participants can register themselves
DROP POLICY IF EXISTS "Participants can register for events" ON event_participants;
CREATE POLICY "Participants can register for events"
  ON event_participants FOR INSERT
  WITH CHECK (auth.uid() = participant_id);

-- Event participants: participants can unregister themselves
DROP POLICY IF EXISTS "Participants can unregister from events" ON event_participants;
CREATE POLICY "Participants can unregister from events"
  ON event_participants FOR DELETE
  USING (auth.uid() = participant_id);

-- Event participants: admins can manage all
DROP POLICY IF EXISTS "Admins can manage event participants" ON event_participants;
CREATE POLICY "Admins can manage event participants"
  ON event_participants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Team members: participants can view their own memberships
DROP POLICY IF EXISTS "Team members can view their teams" ON team_members;
CREATE POLICY "Team members can view their teams"
  ON team_members FOR SELECT
  USING (auth.uid() = participant_id);

-- Team members: participants can join teams
DROP POLICY IF EXISTS "Participants can join teams" ON team_members;
CREATE POLICY "Participants can join teams"
  ON team_members FOR INSERT
  WITH CHECK (auth.uid() = participant_id);

-- Team members: members can leave (delete own membership)
DROP POLICY IF EXISTS "Members can leave teams" ON team_members;
CREATE POLICY "Members can leave teams"
  ON team_members FOR DELETE
  USING (auth.uid() = participant_id);

-- Team members: admins can manage all
DROP POLICY IF EXISTS "Admins can manage team members" ON team_members;
CREATE POLICY "Admins can manage team members"
  ON team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- ================================================================
-- SECTION 7: UPDATE FUNCTIONS
-- ================================================================

-- Updated handle_new_user() with organization_id support
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  selected_role user_role;
  metadata_role text;
  invite_pending boolean;
  org_id uuid;
BEGIN
  -- Check if this is an invite flow user (has invite_pending flag)
  -- If so, skip automatic creation - the verify endpoint will create them
  invite_pending := COALESCE((new.raw_user_meta_data->>'invite_pending')::boolean, false);

  IF invite_pending THEN
    RAISE NOTICE 'Skipping user creation for % - invite pending OTP verification', new.email;
    RETURN new;
  END IF;

  -- Get role from user metadata as text first
  metadata_role := new.raw_user_meta_data->>'role';

  -- Get organization_id from metadata (for admin invites)
  BEGIN
    org_id := (new.raw_user_meta_data->>'organization_id')::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      org_id := NULL;
  END;

  -- Safely cast to user_role enum with nested exception handling
  BEGIN
    IF metadata_role IS NOT NULL AND metadata_role != '' THEN
      selected_role := metadata_role::user_role;
    ELSE
      selected_role := 'judge'::user_role;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      selected_role := 'judge'::user_role;
      RAISE WARNING 'Invalid role "%" in user metadata for %, defaulting to judge', metadata_role, new.email;
  END;

  -- Insert user with role and organization_id from metadata
  -- For most signups: organization_id will be NULL
  -- For admin invites: organization_id comes from metadata
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (new.id, new.email, selected_role, org_id)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Error in handle_new_user for %: %', new.email, SQLERRM;
    RETURN new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function: get user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_organization(user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM users
  WHERE id = user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_organization(uuid) TO authenticated, anon;

-- ================================================================
-- SECTION 8: ORGANIZATION MEMBERS (Judge-Org Many-to-Many)
-- Enables judges to belong to multiple organizations.
-- Admins see only judges who are members of their org.
-- ================================================================

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_organization ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- Data migration: populate from accepted judge invitations
INSERT INTO organization_members (organization_id, user_id)
SELECT DISTINCT i.organization_id, u.id
FROM invitations i
INNER JOIN users u ON u.email = i.email
WHERE i.status = 'accepted'
  AND i.role = 'judge'
  AND i.organization_id IS NOT NULL
  AND u.role = 'judge'
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Also migrate judges who have users.organization_id set (legacy single-org field)
INSERT INTO organization_members (organization_id, user_id)
SELECT u.organization_id, u.id
FROM users u
WHERE u.role = 'judge'
  AND u.organization_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Migrate remaining judges (no invitation, no org) to the default organization
-- so they are not orphaned and invisible to all admins
INSERT INTO organization_members (organization_id, user_id)
SELECT
  (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1),
  u.id
FROM users u
WHERE u.role = 'judge'
  AND NOT EXISTS (
    SELECT 1 FROM organization_members om WHERE om.user_id = u.id
  )
  AND EXISTS (SELECT 1 FROM organizations WHERE slug = 'default')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- RLS for organization_members
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own memberships" ON organization_members;
CREATE POLICY "Users can view own memberships"
  ON organization_members FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own memberships" ON organization_members;
CREATE POLICY "Users can create own memberships"
  ON organization_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage org members" ON organization_members;
CREATE POLICY "Admins can manage org members"
  ON organization_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role::text IN ('admin', 'super_admin')
      AND users.organization_id = organization_members.organization_id
    )
  );

-- ================================================================
-- SUCCESS
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Feature "multi-tenant-participants" migration completed successfully!';
  RAISE NOTICE 'Tables created: organizations, event_participants, team_members, organization_members';
  RAISE NOTICE 'Columns added: events.organization_id, events.max_team_size, teams.join_code, users.organization_id, invitations.organization_id';
  RAISE NOTICE 'Enums updated: event_status (+open), user_role (+super_admin), invitation_role (+admin)';
  RAISE NOTICE 'Default organization created and existing data migrated';
  RAISE NOTICE '========================================';
END $$;
