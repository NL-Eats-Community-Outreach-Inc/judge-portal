-- ================================================================
-- FEATURE MIGRATION: competitions table
-- Description: Creates the competitions table as a 1:1 extension of events
--              for external-facing metadata (LearnWorlds integration)
-- Dependencies: consolidated_setup.sql (events table must exist)
-- ================================================================

-- ============================================================================
-- STEP 1: CREATE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS competitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL UNIQUE,
    title TEXT,
    short_description TEXT,
    cover_image_url TEXT,
    challenge_type TEXT DEFAULT 'global' NOT NULL,
    tags TEXT[],
    prize TEXT,
    deadline TIMESTAMP WITH TIME ZONE,
    country TEXT,
    participant_signup_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================================================================
-- STEP 5: CREATE INDEXES
-- ================================================================

-- Challenges indexes
CREATE INDEX IF NOT EXISTS idx_competitions_event ON competitions(event_id);

-- ================================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- STEP 4: CREATE RLS POLICIES
-- ================================================================

-- Admins can manage competitions for events in their organization
CREATE POLICY "Admins can manage competitions"
    ON competitions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM events e
            JOIN users u ON u.organization_id = e.organization_id
            WHERE e.id = competitions.event_id
            AND u.id = auth.uid()
            AND u.role = 'admin'::user_role
        )
    );

-- Public can view competitions for non-setup events only
CREATE POLICY "Public can view active competitions"
    ON competitions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = competitions.event_id
            AND e.status != 'setup'
        )
    );

-- ================================================================
-- DONE
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE 'Competitions table migration completed successfully';
END $$;
