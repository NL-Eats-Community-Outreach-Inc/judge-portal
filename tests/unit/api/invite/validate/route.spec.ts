import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '@/app/api/invite/validate/route';
import { db } from '@/lib/db';
import { getInvitationByToken } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import * as config from '@/lib/config';
import type { Invitation } from '@/lib/db/schema';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';
import { expectApiError, expectJson } from '@/tests/unit/test-utils/route-harness';

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getInvitationByToken: vi.fn(),
}));
vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }));
vi.mock('@/lib/config', () => ({ SUBMISSIONS_ENABLED: false, EMAIL_FEATURES_ENABLED: false }));

const dbMock = db as unknown as DbMock;
const flags = config as { EMAIL_FEATURES_ENABLED: boolean };
const signInWithOtp = vi.fn();

const EXPIRES_AT = new Date(Date.now() + 86_400_000).toISOString();

function invitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'inv-1',
    token: 'tok-1',
    email: 'invitee@example.com',
    role: 'admin',
    status: 'pending',
    customMessage: 'Welcome',
    expiresAt: EXPIRES_AT,
    acceptedAt: null,
    createdBy: 'sa-1',
    organizationId: 'org-1',
    createdAt: 'x',
    updatedAt: 'x',
    ...overrides,
  };
}

const get = (query = '?token=tok-1') => GET(mockRequest(`/api/invite/validate${query}`));
const post = (body: unknown) => POST(mockRequest('/api/invite/validate', { method: 'POST', body }));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  vi.mocked(getInvitationByToken).mockResolvedValue(invitation());
  signInWithOtp.mockResolvedValue({ error: null });
  vi.mocked(createClient).mockResolvedValue({
    auth: { signInWithOtp },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
});

afterEach(() => {
  flags.EMAIL_FEATURES_ENABLED = false;
});

describe('GET /api/invite/validate', () => {
  it('400 without a token', async () => {
    await expectApiError(await get(''), 400, 'BAD_REQUEST');
  });

  it('404 for an unknown token', async () => {
    vi.mocked(getInvitationByToken).mockResolvedValue(null);
    await expectApiError(await get(), 404, 'NOT_FOUND');
  });

  it('400 INVITATION_INVALID for a revoked invitation', async () => {
    vi.mocked(getInvitationByToken).mockResolvedValue(invitation({ status: 'revoked' }));
    await expectApiError(await get(), 400, 'INVITATION_INVALID');
  });

  it('returns the invitation details with the organization name and no email sent', async () => {
    mockSelectSequence(dbMock.select, [{ name: 'NL Eats' }]);
    expect(await expectJson(await get())).toEqual({
      success: true,
      invitation: {
        email: 'invitee@example.com',
        role: 'admin',
        customMessage: 'Welcome',
        organizationName: 'NL Eats',
      },
    });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});

describe('POST /api/invite/validate (email flow, unlinked from the UI)', () => {
  it('404 FEATURE_DISABLED while the flag is off, before the token is read', async () => {
    await expectApiError(await post({ token: 'tok-1' }), 404, 'FEATURE_DISABLED');
    expect(getInvitationByToken).not.toHaveBeenCalled();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  describe('with the flag on', () => {
    beforeEach(() => {
      flags.EMAIL_FEATURES_ENABLED = true;
    });

    it('400 without a token and 404 for an unknown one', async () => {
      await expectApiError(await post({}), 400, 'BAD_REQUEST');
      vi.mocked(getInvitationByToken).mockResolvedValue(null);
      await expectApiError(await post({ token: 'x' }), 404, 'NOT_FOUND');
    });

    it('400 INVITATION_INVALID for an expired invitation', async () => {
      vi.mocked(getInvitationByToken).mockResolvedValue(
        invitation({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      );
      await expectApiError(await post({ token: 'tok-1' }), 400, 'INVITATION_INVALID');
      expect(signInWithOtp).not.toHaveBeenCalled();
    });

    it('sends the OTP with the invite_pending flag', async () => {
      const body = await expectJson(await post({ token: 'tok-1' }));
      expect(body).toMatchObject({ success: true, invitation: { email: 'invitee@example.com' } });
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: 'invitee@example.com',
        options: { shouldCreateUser: true, data: { invite_pending: true, role: 'admin' } },
      });
    });

    it('500 when the mailer refuses', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      signInWithOtp.mockResolvedValue({ error: new Error('rate limit') });
      await expectApiError(await post({ token: 'tok-1' }), 500, 'INTERNAL_SERVER_ERROR');
      spy.mockRestore();
    });
  });
});
