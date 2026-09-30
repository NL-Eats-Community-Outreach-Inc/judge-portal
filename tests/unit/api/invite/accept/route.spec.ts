import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/invite/accept/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  getInvitationByToken,
  finalizeInvitationAcceptance,
  acceptInvitationForExistingUser,
} from '@/lib/auth/invitation';
import { createAdminClient } from '@/lib/supabase/server';
import type { Invitation } from '@/lib/db/schema';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';
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

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;
const admin = { createUser: vi.fn(), updateUserById: vi.fn(), listUsers: vi.fn() };

const EXPIRES_AT = new Date(Date.now() + 86_400_000).toISOString();

function invitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'inv-1',
    token: 'tok-1',
    email: 'Invitee@Example.com',
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

const post = (body: unknown) => POST(mockRequest('/api/invite/accept', { method: 'POST', body }));
const valid = { token: 'tok-1', password: 'secret-pass' };

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signOut(auth);
  vi.mocked(getInvitationByToken).mockResolvedValue(invitation());
  vi.mocked(finalizeInvitationAcceptance).mockResolvedValue({ redirectUrl: '/judge' });
  vi.mocked(createAdminClient).mockReturnValue({
    auth: { admin },
  } as unknown as ReturnType<typeof createAdminClient>);
  admin.createUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null });
});

describe('POST /api/invite/accept', () => {
  it('400 without a token', async () => {
    await expectApiError(await post({ password: 'secret-pass' }), 400, 'BAD_REQUEST');
  });

  it('404 for an unknown token', async () => {
    vi.mocked(getInvitationByToken).mockResolvedValue(null);
    await expectApiError(await post(valid), 404, 'NOT_FOUND');
  });

  it.each([
    ['revoked', { status: 'revoked' as const }, 'This invitation has been revoked'],
    ['used', { status: 'accepted' as const }, 'This invitation has already been used'],
    [
      'expired',
      { expiresAt: new Date(Date.now() - 1000).toISOString() },
      'This invitation has expired',
    ],
  ])('400 INVITATION_INVALID for a %s invitation', async (_label, overrides, message) => {
    vi.mocked(getInvitationByToken).mockResolvedValue(invitation(overrides));
    const body = await expectApiError(await post(valid), 400, 'INVITATION_INVALID');
    expect(body.error).toBe(message);
  });

  describe('when the email already has an account', () => {
    const existing = { id: 'user-1', email: 'invitee@example.com', role: 'judge' };

    it('409 EXISTING_ACCOUNT without a session and never touches the account', async () => {
      mockSelectSequence(dbMock.select, [existing]);
      await expectApiError(await post(valid), 409, 'EXISTING_ACCOUNT');
      expect(admin.createUser).not.toHaveBeenCalled();
      expect(admin.updateUserById).not.toHaveBeenCalled();
      expect(acceptInvitationForExistingUser).not.toHaveBeenCalled();
      expect(finalizeInvitationAcceptance).not.toHaveBeenCalled();
    });

    it('409 EXISTING_ACCOUNT when a different account is signed in', async () => {
      signInAs(auth, fakeUser('judge', { id: 'someone-else' }));
      mockSelectSequence(dbMock.select, [existing]);
      await expectApiError(await post(valid), 409, 'EXISTING_ACCOUNT');
      expect(acceptInvitationForExistingUser).not.toHaveBeenCalled();
    });

    it('applies the invitation for the account’s own session', async () => {
      signInAs(auth, fakeUser('judge', { id: 'user-1' }));
      mockSelectSequence(dbMock.select, [existing]);
      vi.mocked(acceptInvitationForExistingUser).mockResolvedValue({
        accepted: true,
        redirectUrl: '/judge',
        message: 'You have been added to a new organization.',
      });

      const body = await expectJson(await post({ token: 'tok-1' }));

      expect(body).toEqual({
        success: true,
        redirectUrl: '/judge',
        message: 'You have been added to a new organization.',
      });
      expect(acceptInvitationForExistingUser).toHaveBeenCalledWith(invitation(), existing);
      expect(admin.createUser).not.toHaveBeenCalled();
    });

    it('400 ALREADY_HAS_ACCOUNT with the redirect when nothing applies', async () => {
      signInAs(auth, fakeUser('participant', { id: 'user-1' }));
      mockSelectSequence(dbMock.select, [existing]);
      vi.mocked(acceptInvitationForExistingUser).mockResolvedValue({
        accepted: false,
        redirectUrl: '/participant',
        message: 'You already have an account.',
      });

      const body = await expectApiError(await post({ token: 'tok-1' }), 400, 'ALREADY_HAS_ACCOUNT');

      expect(body.redirectUrl).toBe('/participant');
    });
  });

  describe('for a new account', () => {
    beforeEach(() => mockSelectSequence(dbMock.select, []));

    it('400 INVALID_PASSWORD for a short or missing password', async () => {
      await expectApiError(
        await post({ token: 'tok-1', password: 'abc' }),
        400,
        'INVALID_PASSWORD'
      );
      mockSelectSequence(dbMock.select, []);
      await expectApiError(await post({ token: 'tok-1' }), 400, 'INVALID_PASSWORD');
      expect(admin.createUser).not.toHaveBeenCalled();
    });

    it('creates a confirmed auth user with no email and finalizes the invitation', async () => {
      const body = await expectJson(await post(valid));

      expect(body).toEqual({ success: true, redirectUrl: '/judge', email: 'Invitee@Example.com' });
      expect(admin.createUser).toHaveBeenCalledWith({
        email: 'Invitee@Example.com',
        password: 'secret-pass',
        email_confirm: true,
        user_metadata: { invite_pending: true, role: 'judge' },
      });
      expect(finalizeInvitationAcceptance).toHaveBeenCalledWith(invitation(), 'auth-1');
    });

    it('claims an orphaned auth user (no profile row) by setting its password', async () => {
      admin.createUser.mockResolvedValue({ data: { user: null }, error: new Error('exists') });
      admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'orphan-1', email: 'invitee@example.com', user_metadata: {} }] },
        error: null,
      });
      admin.updateUserById.mockResolvedValue({ data: {}, error: null });
      mockSelectSequence(dbMock.select, [], []);

      const body = await expectJson(await post(valid));

      expect(body).toMatchObject({ success: true, redirectUrl: '/judge' });
      expect(admin.updateUserById).toHaveBeenCalledWith(
        'orphan-1',
        expect.objectContaining({ password: 'secret-pass', email_confirm: true })
      );
      expect(finalizeInvitationAcceptance).toHaveBeenCalledWith(invitation(), 'orphan-1');
    });

    it('409 EXISTING_ACCOUNT when the auth user already has a profile row under another email', async () => {
      admin.createUser.mockResolvedValue({ data: { user: null }, error: new Error('exists') });
      admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'orphan-1', email: 'invitee@example.com', user_metadata: {} }] },
        error: null,
      });
      mockSelectSequence(dbMock.select, [], [{ id: 'orphan-1' }]);

      await expectApiError(await post(valid), 409, 'EXISTING_ACCOUNT');
      expect(admin.updateUserById).not.toHaveBeenCalled();
    });

    it('500 ACCOUNT_CREATION_FAILED when the auth user cannot be created or found', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      admin.createUser.mockResolvedValue({ data: { user: null }, error: new Error('down') });
      admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });

      await expectApiError(await post(valid), 500, 'ACCOUNT_CREATION_FAILED');
      expect(finalizeInvitationAcceptance).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
