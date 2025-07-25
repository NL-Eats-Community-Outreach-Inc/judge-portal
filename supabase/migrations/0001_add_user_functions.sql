-- Create a function to check if user exists and get their role
-- This function runs with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION check_user_role(user_id uuid)
RETURNS TABLE(role user_role)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.role
  FROM users u
  WHERE u.id = user_id
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_role(uuid) TO anon;