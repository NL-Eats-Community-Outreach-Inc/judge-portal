import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/invite/verify/route';
import { db } from '@/lib/db';
import * as config from '@/lib/config';
import {
  getInvitationByToken,
  finalizeInvitationAcceptance,
  acceptInvitationForExistingUser,
} from '@/lib/auth/invitation';
import { createClient } from '@/lib/supabase/server';
import type { Invitation } from '@/lib/db/schema';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';
import { expectApiError, expectJson } from '@/tests/unit/test-utils/route-harness';

vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});
vi.mock('@/lib/auth/invitation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/invitation')>()),
  getInvitationByToken: vi.fn(),
  finalizeInvitationAcceptance: vi.fn(),
  acceptInvitationForExistingUser: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }));
vi.mock('@/lib/config', () => ({ SUBMISSIONS_ENABLED: false, EMAIL_FEATURES_ENABLED: false }));

const dbMock = db as unknown as DbMock;
const flags = config as { EMAIL_FEATURES_ENABLED: boolean };
const verifyOtp = vi.fn();

const EXPIRES_AT = new Date(Date.now() + 86_400_000).toISOString();

function invitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'inv-1',
    token: 'tok-1',
    email: 'invitee@example.com',
    role: 'judge',
    status: 'pending',
    customMessage: null,
    expiresAt: EXPIRES_AT,
    acceptedAt: null,
    createdBy: 'admin-1',
    organizationId: 'org-1',
    createdAt: 'x',
    updatedAt: 'x',
    ...overrides,
  };
}

const post = (body: unknown) => POST(mockRequest('/api/invite/verify', { method: 'POST', body }));
const valid = { token: 'tok-1', otp: '123456' };

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  vi.mocked(getInvitationByToken).mockResolvedValue(invitation());
  vi.mocked(finalizeInvitationAcceptance).mockResolvedValue({ redirectUrl: '/judge' });
  verifyOtp.mockResolvedValue({
    data: { user: { id: 'auth-1', email: 'invitee@example.com' } },
    error: null,
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: { verifyOtp },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
});

afterEach(() => {
  flags.EMAIL_FEATURES_ENABLED = false;
});

describe('POST /api/invite/verify (email flow, unlinked from the UI)', () => {
  it('404 FEATURE_DISABLED while the flag is off, before the token is read', async () => {
    await expectApiError(await post(valid), 404, 'FEATURE_DISABLED');
    expect(getInvitationByToken).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe('POST /api/invite/verify with the flag on', () => {
  beforeEach(() => {
    flags.EMAIL_FEATURES_ENABLED = true;
  });

  it('400 without token and otp', async () => {
    await expectApiError(await post({ token: 'tok-1' }), 400, 'BAD_REQUEST');
  });

  it('404 for an unknown token', async () => {
    vi.mocked(getInvitationByToken).mockResolvedValue(null);
    await expectApiError(await post(valid), 404, 'NOT_FOUND');
  });

  it('400 INVITATION_INVALID for a used invitation', async () => {
    vi.mocked(getInvitationByToken).mockResolvedValue(invitation({ status: 'accepted' }));
    await expectApiError(await post(valid), 400, 'INVITATION_INVALID');
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('400 INVALID_OTP when the code is refused', async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: new Error('bad') });
    await expectApiError(await post(valid), 400, 'INVALID_OTP');
  });

  it('finalizes a new account', async () => {
    mockSelectSequence(dbMock.select, []);
    const body = await expectJson(await post(valid));
    expect(body).toEqual({
      success: true,
      redirectUrl: '/judge',
      user: { id: 'auth-1', email: 'invitee@example.com', role: 'judge' },
    });
    expect(finalizeInvitationAcceptance).toHaveBeenCalledWith(invitation(), 'auth-1');
  });

  it('applies the existing-account rules for a known user', async () => {
    const existing = { id: 'auth-1', email: 'invitee@example.com', role: 'judge' };
    mockSelectSequence(dbMock.select, [existing]);
    vi.mocked(acceptInvitationForExistingUser).mockResolvedValue({
      accepted: false,
      redirectUrl: '/judge',
      message: 'You are already a member of this organization.',
    });

    const body = await expectApiError(await post(valid), 400, 'ALREADY_HAS_ACCOUNT');

    expect(body).toMatchObject({ existingRole: 'judge', redirectUrl: '/judge' });
    expect(finalizeInvitationAcceptance).not.toHaveBeenCalled();
  });
});
