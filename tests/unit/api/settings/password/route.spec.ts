import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/settings/password/route';
import { authServer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import {
  fakeUser,
  signInAs,
  signOut,
  expectApiError,
  expectJson,
  type AuthServerMock,
} from '@/tests/unit/test-utils/route-harness';

vi.mock('@/lib/auth', async () => {
  const { buildAuthServerMock } = await import('@/tests/unit/test-utils/route-harness');
  return { authServer: buildAuthServerMock() };
});
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }));

const auth = authServer as unknown as AuthServerMock;
const updateUser = vi.fn();
const post = (body: unknown) =>
  POST(mockRequest('/api/settings/password', { method: 'POST', body }));

beforeEach(() => {
  vi.clearAllMocks();
  signInAs(auth, fakeUser('judge'));
  updateUser.mockResolvedValue({ error: null });
  vi.mocked(createClient).mockResolvedValue({
    auth: { updateUser },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
});

describe('POST /api/settings/password', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post({ newPassword: 'longenough' }), 401, 'UNAUTHORIZED');
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('works for every signed-in role', async () => {
    for (const role of ['admin', 'participant', 'super_admin'] as const) {
      signInAs(auth, fakeUser(role));
      await expectJson(await post({ newPassword: 'longenough' }));
    }
  });

  it('400 for a password shorter than 6 characters', async () => {
    await expectApiError(await post({ newPassword: 'abc' }), 400, 'BAD_REQUEST');
    await expectApiError(await post({}), 400, 'BAD_REQUEST');
  });

  it('400 PASSWORD_UPDATE_FAILED with the provider’s message', async () => {
    updateUser.mockResolvedValue({ error: { message: 'Same as the old password' } });
    const body = await expectApiError(
      await post({ newPassword: 'longenough' }),
      400,
      'PASSWORD_UPDATE_FAILED'
    );
    expect(body.error).toBe('Same as the old password');
  });

  it('updates the password through the session-bound client', async () => {
    expect(await expectJson(await post({ newPassword: 'longenough' }))).toEqual({
      success: true,
      message: 'Password updated successfully',
    });
    expect(updateUser).toHaveBeenCalledWith({ password: 'longenough' });
  });
});
