-- Fix circular dependency in users table RLS policy
-- The existing policy creates a circular dependency where checking user role requires accessing users table

-- Enable RLS on users table
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all users" ON "users";

-- Create policies that avoid circular dependency using the security definer function
-- Allow users to view their own record
CREATE POLICY "Users can view their own record" ON "users"
FOR SELECT TO public
USING (auth.uid() = id);

-- Allow admins to view all users using the check_user_role function to avoid circular dependency
CREATE POLICY "Admins can view all users" ON "users"
FOR SELECT TO public
USING ((SELECT role FROM check_user_role(auth.uid())) = 'admin'::user_role);

-- Allow admins to update user roles
CREATE POLICY "Admins can update users" ON "users"
FOR UPDATE TO public
USING ((SELECT role FROM check_user_role(auth.uid())) = 'admin'::user_role);