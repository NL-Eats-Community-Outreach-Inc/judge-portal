-- ================================================================
-- FEATURE: Invite Link System with OTP
-- Description: Allows admins to send invite links to judges/participants
-- Dependencies: consolidated_setup.sql (baseline must exist)
-- ================================================================

-- Step 1: Create invitation role enum
DO $$ BEGIN
  CREATE TYPE invitation_role AS ENUM ('judge', 'participant');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Create invitation status enum
DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 3: Update user_role enum to support participants
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'participant';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 4: Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role invitation_role NOT NULL,
  status invitation_status DEFAULT 'pending' NOT NULL,
  custom_message TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email_event ON invitations(email, event_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_event ON invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_invitations_created_by ON invitations(created_by);

-- Step 6: Enable Row Level Security
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies

-- Admins can manage all invitations
DROP POLICY IF EXISTS "Admins can manage invitations" ON invitations;
CREATE POLICY "Admins can manage invitations"
  ON invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Users can view their own invitations by email
DROP POLICY IF EXISTS "Users can view their own invitations" ON invitations;
CREATE POLICY "Users can view their own invitations"
  ON invitations FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Feature "invite-link" migration completed successfully!';
END $$;
