-- ================================================================
-- FEATURE MIGRATION: mentor profiles table
-- Description: Creates the mentor profiles table to store mentor information
--              separated from the core user auth table for security and performance
-- Dependencies: None
-- ================================================================

-- ============================================================================
-- STEP 1: CREATE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS mentor_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    learnworlds_user_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    title TEXT,
    organization TEXT,
    bio TEXT,
    linkedin_url TEXT,
    calendly_url TEXT,
    photo_url TEXT,
    tags TEXT[],
    is_visible BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================================================================
-- STEP 2: ENABLE ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE mentor_profiles ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- STEP 3: CREATE RLS POLICIES
-- ================================================================

-- Policy: Public can view visible mentor profiles for visible mentor profiles only
CREATE POLICY "Public can view visible mentor profiles"
    ON mentor_profiles FOR SELECT
    USING (is_visible = true);

-- ============================================================================
-- STEP 4: CREATE TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_mentor_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mentor_profiles_updated_at ON mentor_profiles;

CREATE TRIGGER mentor_profiles_updated_at
    BEFORE UPDATE ON mentor_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_mentor_profiles_updated_at();

-- ================================================================
-- DONE
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE 'Mentor profiles table migration completed successfully';
END $$;
