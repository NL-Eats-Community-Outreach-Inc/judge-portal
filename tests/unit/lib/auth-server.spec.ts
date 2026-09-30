import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { authServer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';

vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }));

const dbMock = db as unknown as DbMock;
const getUser = vi.fn();

function session(user: { id: string; email: string } | null) {
  getUser.mockResolvedValue({ data: { user }, error: user ? null : new Error('no session') });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
});

describe('authServer.getUser', () => {
  it('returns null without a session and never reads the profile', async () => {
    session(null);
    expect(await authServer.getUser()).toBeNull();
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('merges the profile role and organization into the auth user', async () => {
    session({ id: 'u1', email: 'a@example.com' });
    mockSelectSequence(dbMock.select, [{ role: 'admin', organizationId: 'org-1' }]);
    expect(await authServer.getUser()).toMatchObject({
      id: 'u1',
      role: 'admin',
      organizationId: 'org-1',
    });
  });
});

describe('authServer.require*', () => {
  it('requireAuth throws "Authentication required" without a session', async () => {
    session(null);
    await expect(authServer.requireAuth()).rejects.toThrow('Authentication required');
  });

  it.each([
    ['requireAdmin', 'admin'],
    ['requireJudge', 'judge'],
    ['requireParticipant', 'participant'],
    ['requireSuperAdmin', 'super_admin'],
  ] as const)('%s admits only the %s role', async (method, role) => {
    for (const actual of ['admin', 'judge', 'participant', 'super_admin'] as const) {
      session({ id: 'u1', email: 'a@example.com' });
      mockSelectSequence(dbMock.select, [{ role: actual, organizationId: null }]);
      const call = authServer[method]();
      if (actual === role) {
        await expect(call).resolves.toMatchObject({ role });
      } else {
        await expect(call).rejects.toThrow(`${role} role required`);
      }
    }
  });

  it('rejects a session whose profile row is missing (no role)', async () => {
    session({ id: 'u1', email: 'a@example.com' });
    mockSelectSequence(dbMock.select, []);
    await expect(authServer.requireJudge()).rejects.toThrow('judge role required');
  });
});
