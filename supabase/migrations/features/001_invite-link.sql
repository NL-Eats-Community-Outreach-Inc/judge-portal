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
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
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

-- Step 8: Add INSERT policy for users table to allow trigger function to insert
-- This fixes the issue where RLS blocks the handle_new_user trigger from inserting new users
-- Allow INSERT during signup (when auth.uid() is NULL - trigger context)
-- OR when inserting own record (id matches auth.uid() - for API calls)
DROP POLICY IF EXISTS "Allow authenticated user creation" ON users;
CREATE POLICY "Allow authenticated user creation"
  ON users FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL OR  -- Trigger context during signup
    auth.uid() = id         -- User creating their own record
  );

-- Step 9: Update handle_new_user trigger to read role from metadata
-- This fixes the issue where all OTP signups were getting 'judge' role
-- Function runs as SECURITY DEFINER to bypass RLS on users table insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  selected_role user_role;
  metadata_role text;
BEGIN
  -- Get role from user metadata as text first
  metadata_role := new.raw_user_meta_data->>'role';

  -- Safely cast to user_role enum with nested exception handling
  BEGIN
    IF metadata_role IS NOT NULL AND metadata_role != '' THEN
      -- Try to cast the role from metadata
      selected_role := metadata_role::user_role;
    ELSE
      -- No role in metadata, default to judge
      selected_role := 'judge'::user_role;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- If cast fails (invalid role value), default to judge
      selected_role := 'judge'::user_role;
      RAISE WARNING 'Invalid role "%" in user metadata for %, defaulting to judge', metadata_role, new.email;
  END;

  -- Insert user with role from metadata (bypassing RLS)
  INSERT INTO public.users (id, email, role)
  VALUES (new.id, new.email, selected_role)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Error in handle_new_user for %: %', new.email, SQLERRM;
    -- Don't return null, just return new to avoid blocking signup
    RETURN new;
END;
$$;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Feature "invite-link" migration completed successfully!';
  RAISE NOTICE 'User role trigger updated - now reads from user metadata';
END $$;
