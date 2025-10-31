const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env');
}

// Safety check: ensure we're using test database
if (!SUPABASE_URL.includes('ynexconwrqhiohlvpnav')) {
  throw new Error('Test utilities must use test Supabase project only!');
}

/**
 * Look up a user by exact email using the Admin API and return the single user id.
 * Throws if not found or if multiple found.
 */
export async function getUserIdByEmail(email: string): Promise<string> {
  const url = `${SUPABASE_URL}/auth/v1/admin/users`;

  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[getUserIdByEmail] Admin lookup failed ${res.status}: ${body}`);
  }

  const data = await res.json();
  const users = data.users || [];

  const matchedUser = users.find((u: any) => u.email === email);
  if (!matchedUser) {
    throw new Error(`[getUserIdByEmail] No user found for ${email}`);
  }

  return matchedUser.id;
}

/**
 * Delete a test user - must delete from database first, then auth
 */
export async function cleanupTestUserById(userId: string) {
  // Step 1: Delete from database using SQL (cascades to scores, event_judges, etc)
  const sqlUrl = `${SUPABASE_URL}/rest/v1/rpc/delete_user_cascade`;
  const sqlRes = await fetch(sqlUrl, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });

  // If RPC doesn't exist, delete directly from users table
  if (sqlRes.status === 404) {
    const deleteUrl = `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`;
    const delRes = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });
    if (!delRes.ok && delRes.status !== 404) {
      console.error('[cleanup] DB delete failed:', delRes.status);
    }
  }

  // Step 2: Delete from auth
  const authUrl = `${SUPABASE_URL}/auth/v1/admin/users/${userId}`;
  const authRes = await fetch(authUrl, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (!authRes.ok && authRes.status !== 404) {
    const body = await authRes.text();
    console.error('[cleanup] Auth delete failed:', authRes.status, body);
  }

  console.log(`[cleanup] Deleted user ${userId}`);
}
