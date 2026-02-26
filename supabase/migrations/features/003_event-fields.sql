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
-- SUCCESS
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Feature "extended-event-fields" migration completed successfully!';
    RAISE NOTICE 'Columns added: events.prize, events.tags, events.submission_deadline';
    RAISE NOTICE '========================================';
END $$;