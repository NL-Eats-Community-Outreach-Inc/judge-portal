/**
 * Service-role access to the test project for setup and cleanup: the auth
 * admin API for accounts and PostgREST for the profile, organization and
 * membership rows. Refuses to load unless ALLOW_TEST_UTILITIES=true and the
 * configured project is the test project (the suite deletes every `QA-`
 * event and writes accounts, so it must never run against production).
 */
const TEST_PROJECT_REF = 'lqqmxxbxvsnoivebdywb';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
}
if (process.env.ALLOW_TEST_UTILITIES !== 'true') {
  throw new Error(
    'Set ALLOW_TEST_UTILITIES=true in .env.local to run the end-to-end suite. Never set it in production.'
  );
}
if (!SUPABASE_URL.includes(TEST_PROJECT_REF)) {
  throw new Error(
    `Refusing: NEXT_PUBLIC_SUPABASE_URL does not point at the test project (${TEST_PROJECT_REF})`
  );
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

type Role = 'admin' | 'judge' | 'participant' | 'super_admin';

export async function rest<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {}
): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: { ...headers, ...(init.prefer ? { Prefer: init.prefer } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${path} failed (${response.status}): ${await response.text()}`
    );
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function authAdmin<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {}
) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, json: json as T };
}

export async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  const target = email.toLowerCase();
  for (let page = 1; page < 50; page++) {
    const { ok, json } = await authAdmin<{ users: Array<{ id: string; email?: string }> }>(
      `users?page=${page}&per_page=1000`
    );
    if (!ok) throw new Error('Auth user listing failed');
    const match = json.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;
    if (json.users.length < 1000) return null;
  }
  return null;
}

/**
 * Creates the auth user (confirmed, no email) and its profile row with `role`,
 * or repairs an existing one so the password and role are what the specs expect.
 */
export async function ensureUser(email: string, password: string, role: Role): Promise<string> {
  let user = await findAuthUserByEmail(email);
  if (!user) {
    const created = await authAdmin<{ id: string }>('users', {
      method: 'POST',
      body: { email, password, email_confirm: true, user_metadata: { role } },
    });
    if (!created.ok) throw new Error(`Could not create ${email}: ${JSON.stringify(created.json)}`);
    user = created.json;
  } else {
    const updated = await authAdmin(`users/${user.id}`, {
      method: 'PUT',
      body: { password, email_confirm: true },
    });
    if (!updated.ok) throw new Error(`Could not update ${email}`);
  }

  // The trigger inserts the profile row; make sure it exists with the right role
  const rows = await rest<Array<{ id: string }>>(`users?id=eq.${user.id}&select=id`);
  if (rows.length === 0) {
    await rest('users', {
      method: 'POST',
      body: { id: user.id, email, role },
      prefer: 'return=minimal',
    });
  } else {
    await rest(`users?id=eq.${user.id}`, {
      method: 'PATCH',
      body: { role },
      prefer: 'return=minimal',
    });
  }
  return user.id;
}

/**
 * An auth user whose profile row is missing (the event-day case sync-users
 * repairs): created confirmed with `user_metadata`, then the row the trigger
 * inserted is removed. Returns the auth user id.
 */
export async function ensureAuthUserWithoutProfile(
  email: string,
  password: string,
  metadata: Record<string, unknown>
): Promise<string> {
  await deleteUserByEmail(email);
  const created = await authAdmin<{ id: string }>('users', {
    method: 'POST',
    body: { email, password, email_confirm: true, user_metadata: metadata },
  });
  if (!created.ok) throw new Error(`Could not create ${email}: ${JSON.stringify(created.json)}`);
  await rest(`users?id=eq.${created.json.id}`, { method: 'DELETE', prefer: 'return=minimal' });
  return created.json.id;
}

export async function ensureOrganization(name: string, slug: string): Promise<string> {
  const existing = await rest<Array<{ id: string }>>(`organizations?slug=eq.${slug}&select=id`);
  if (existing[0]) return existing[0].id;
  const [created] = await rest<Array<{ id: string }>>('organizations', {
    method: 'POST',
    body: { name, slug, description: 'End-to-end test organization' },
    prefer: 'return=representation',
  });
  return created.id;
}

export async function setUserOrganization(userId: string, organizationId: string | null) {
  await rest(`users?id=eq.${userId}`, {
    method: 'PATCH',
    body: { organization_id: organizationId },
    prefer: 'return=minimal',
  });
}

export async function ensureMembership(organizationId: string, userId: string) {
  const existing = await rest<Array<{ id: string }>>(
    `organization_members?organization_id=eq.${organizationId}&user_id=eq.${userId}&select=id`
  );
  if (existing.length > 0) return;
  await rest('organization_members', {
    method: 'POST',
    body: { organization_id: organizationId, user_id: userId },
    prefer: 'return=minimal',
  });
}

export async function removeMembership(organizationId: string, userId: string) {
  await rest(`organization_members?organization_id=eq.${organizationId}&user_id=eq.${userId}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
}

/** Deletes the profile row (cascades) and then the auth user. Safe when either is gone. */
export async function deleteUserById(userId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, { method: 'DELETE', headers });
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers });
}

export async function deleteUserByEmail(email: string) {
  const user = await findAuthUserByEmail(email);
  if (user) await deleteUserById(user.id);
}

export async function deleteInvitationsFor(email: string) {
  await rest(`invitations?email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
}

export async function deleteOrganizationBySlug(slug: string) {
  await rest(`organizations?slug=eq.${slug}`, { method: 'DELETE', prefer: 'return=minimal' });
}

/** Removes every `QA-` event (cascades to teams, criteria, scores, assignments). */
export async function deleteQaEvents() {
  await rest('events?name=like.QA-*', { method: 'DELETE', prefer: 'return=minimal' });
}

export async function countRows(table: string, filter = ''): Promise<number> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id${filter}`, {
    headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
  });
  const range = response.headers.get('content-range') ?? '*/0';
  return Number(range.split('/')[1]);
}
