const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type TestUserRole = 'admin' | 'judge' | 'participant';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env');
}

if (process.env.ALLOW_TEST_UTILITIES !== 'true') {
  throw new Error(
    'Set ALLOW_TEST_UTILITIES=true in .env.local to run test utilities. ' +
      'Never set this in production!'
  );
}

async function updateUserRoleWithRetry(userId: string, role: TestUserRole): Promise<void> {
  const updateUrl = `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role }),
    });

    if (updateRes.ok) {
      return;
    }

    if (attempt === 4) {
      const body = await updateRes.text();
      throw new Error(`[createTestUser] Failed updating role (${updateRes.status}): ${body}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

export async function createTestUser(
  email: string,
  password: string,
  role: TestUserRole
): Promise<string> {
  const createUrl = `${SUPABASE_URL}/auth/v1/admin/users`;

  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role },
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`[createTestUser] Auth user create failed ${createRes.status}: ${body}`);
  }

  const created = await createRes.json();
  const userId: string | undefined = created?.id ?? created?.user?.id;

  if (!userId) {
    throw new Error('[createTestUser] Created user response missing id');
  }

  await updateUserRoleWithRetry(userId, role);
  return userId;
}
