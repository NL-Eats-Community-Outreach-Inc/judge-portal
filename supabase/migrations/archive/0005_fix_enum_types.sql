-- Fix enum types for events.status and users.role to match schema
-- The enums already exist, we just need to change the column types

-- Drop the old check constraints (they're no longer needed with enums)
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "check_event_status";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "check_user_role";

-- Convert events.status to use the existing event_status enum
ALTER TABLE "events" 
ALTER COLUMN "status" 
SET DATA TYPE "public"."event_status" 
USING "status"::"public"."event_status";

-- Set proper default for events.status
ALTER TABLE "events" 
ALTER COLUMN "status" 
SET DEFAULT 'setup'::"public"."event_status";

-- Convert users.role to use the existing user_role enum  
ALTER TABLE "users" 
ALTER COLUMN "role" 
SET DATA TYPE "public"."user_role" 
USING "role"::"public"."user_role";

-- Set proper default for users.role
ALTER TABLE "users" 
ALTER COLUMN "role" 
SET DEFAULT 'judge'::"public"."user_role";