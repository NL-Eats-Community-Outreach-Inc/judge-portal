-- ================================================================
-- FEATURE: Extended Event Fields
-- Description: Adds prize, tags, and submission_deadline to the events table
-- Dependencies: consolidated_setup.sql, 001_invite-link.sql, 002_multi-tenant-participants.sql
-- ================================================================

-- ================================================================
-- SECTION 1: ADD COLUMNS TO EXISTING TABLES
-- ================================================================

-- events.prize
DO $$ BEGIN
    ALTER TABLE events ADD COLUMN prize TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- events.tags
DO $$ BEGIN
    ALTER TABLE events ADD COLUMN tags TEXT[];
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- events.submission_deadline
DO $$ BEGIN 
    ALTER TABLE events ADD COLUMN submission_deadline TIMESTAMP WITH TIME ZONE; 
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- ================================================================
-- SECTION 2: CREATE NEW TABLES
-- ================================================================

-- Competitions
CREATE TABLE if NOT EXISTS competitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT not NULL,
    description TEXT,
    status event_status DEAFULT setup,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    max_team_size INTEGER,
    prize TEXT,
    tags TEXT[],
    submission_deadline TIMESTAMP with TIME ZONE,
    country TEXT,
    created_at TIMESTAMP with TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP with TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_competitions_organization ON competitions(organization_id);

-- ================================================================
-- SUCCESS
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Feature "extended-event-fields" migration completed successfully!';
    RAISE NOTICE 'Columns added: events.prize, events.tags, events.submission_deadline';
    RAISE NOTICE 'Tables created: competitions',
    RAISE NOTICE '========================================';
END $$;