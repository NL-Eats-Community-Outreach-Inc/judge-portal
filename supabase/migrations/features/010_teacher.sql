-- Allow teacher as an assigned/current user role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'teacher';

-- Allow administrators to invite teachers
ALTER TYPE invitation_role ADD VALUE IF NOT EXISTS 'teacher';

-- Sanity document IDs are strings, not UUIDs
ALTER TABLE lessons
ALTER COLUMN "sanityDocumentId"
TYPE text
USING "sanityDocumentId"::text;