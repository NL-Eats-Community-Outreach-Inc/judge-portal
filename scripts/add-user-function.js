const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);

async function addUserFunction() {
  try {
    console.log('Creating user function...');
    
    await sql`
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
    `;
    
    await sql`
      GRANT EXECUTE ON FUNCTION check_user_role(uuid) TO authenticated;
    `;
    
    await sql`
      GRANT EXECUTE ON FUNCTION check_user_role(uuid) TO anon;
    `;
    
    console.log('User function created successfully!');
    
  } catch (error) {
    console.error('Error creating user function:', error);
  } finally {
    await sql.end();
  }
}

addUserFunction();