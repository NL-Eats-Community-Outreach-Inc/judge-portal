-- Fix enum types for events.status and users.role to match schema
-- Need to temporarily drop RLS policies that reference the columns being altered

-- Step 1: Drop RLS policies that reference users.role
DROP POLICY IF EXISTS "Admins can manage criteria" ON "criteria";
DROP POLICY IF EXISTS "Admins can manage events" ON "events";
DROP POLICY IF EXISTS "Admins can view all scores" ON "scores";
DROP POLICY IF EXISTS "Admins can manage teams" ON "teams";
DROP POLICY IF EXISTS "Admins can view all users" ON "users";

-- Step 2: Drop old check constraints (they're no longer needed with enums)
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "check_event_status";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "check_user_role";

-- Step 3: Convert events.status to use the existing event_status enum
ALTER TABLE "events" 
ALTER COLUMN "status" 
SET DATA TYPE "public"."event_status" 
USING "status"::"public"."event_status";

-- Set proper default for events.status
ALTER TABLE "events" 
ALTER COLUMN "status" 
SET DEFAULT 'setup'::"public"."event_status";

-- Step 4: Convert users.role to use the existing user_role enum  
ALTER TABLE "users" 
ALTER COLUMN "role" 
SET DATA TYPE "public"."user_role" 
USING "role"::"public"."user_role";

-- Set proper default for users.role
ALTER TABLE "users" 
ALTER COLUMN "role" 
SET DEFAULT 'judge'::"public"."user_role";

-- Step 5: Recreate RLS policies with proper enum references
CREATE POLICY "Admins can manage criteria" ON "criteria"
FOR ALL TO public
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'admin'::user_role
));

CREATE POLICY "Admins can manage events" ON "events"
FOR ALL TO public
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'admin'::user_role
));

CREATE POLICY "Admins can view all scores" ON "scores"
FOR ALL TO public
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'admin'::user_role
));

CREATE POLICY "Admins can manage teams" ON "teams"
FOR ALL TO public
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'admin'::user_role
));

CREATE POLICY "Admins can view all users" ON "users"
FOR ALL TO public
USING (EXISTS (
  SELECT 1 FROM users users_1 
  WHERE users_1.id = auth.uid() 
  AND users_1.role = 'admin'::user_role
));