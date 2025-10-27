//import { createClient } from '@supabase/supabase-js';
//import { getCurrentUser } from '@/lib/auth/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env');
}


async function srFetch(url: string, opts: RequestInit = {}) {
  opts.headers = {
    ...(opts.headers || {}),
    apiKey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(url, opts);
  const txt = await res.text();
  let body: any;
  try { body = JSON.parse(txt); } catch { body = txt; }
  return { res, body };
}

/**
 * Look up a user by exact email using the Admin API and return the single user id.
 * Throws if not found or if multiple found.
 */
export async function getUserIdByEmail(email: string): Promise<string> {
  const ADMIN_USERS_BASE = `${SUPABASE_URL}/auth/v1/admin/users`;
  const url = `${ADMIN_USERS_BASE}?email=${encodeURIComponent(email)}`;
  const { res, body } = await srFetch(url, { method: 'GET' });

  if (!res.ok) {
    throw new Error(`[getUserIdByEmail] Admin lookup failed ${res.status}: ${JSON.stringify(body)}`);
  }

  // Admin might return { users: [...] } or an array depending on versions; normalize
  const users = Array.isArray(body) ? body : (Array.isArray(body?.users) ? body.users : []);
  if (!users || users.length === 0) {
    throw new Error(`[getUserIdByEmail] No user found for ${email}`);
  }
  if (users.length > 1) {
    throw new Error(`[getUserIdByEmail] Multiple users found for ${email}: ${users.map((u:any)=>u.id).join(', ')}`);
  }
  return users[0].id;
}

// TODO: Delete functionality.
export async function cleanupTestUserById(userId: string) {
  //const url = `${SUPABASE_URL}/rpc/cleanup_test_user_by_id`;
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: 'DELETE'
    /* headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ p_user_id: userId }), */
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('[cleanup] Response error', res.status, body);
    throw new Error(`Cleanup failed ${res.status}: ${JSON.stringify(body)}`);
  }
  console.log('[cleanup] Cleanup result', body);
  return body;
}