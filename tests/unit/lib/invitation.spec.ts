import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  isInvitationValid,
  calculateExpirationDate,
  invitationRedirectUrl,
  finalizeInvitationAcceptance,
  acceptInvitationForExistingUser,
  getExistingInvitation,
} from '@/lib/auth/invitation';
import type { Invitation } from '@/lib/db/schema';
import {
  buildSelectMock,
  buildAssertableSelectMock,
  buildAssertableMutationMock,
  mockSelectSequence,
} from '../test-utils/mock-db';

vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('../test-utils/mock-db');
  return { db: buildDbMock() };
});

function invitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'inv-1',
    token: 'tok',
    email: 'Judge@Example.com',
    role: 'judge',
    status: 'pending',
    customMessage: null,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    acceptedAt: null,
    createdBy: 'admin-1',
    organizationId: 'org-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('isInvitationValid', () => {
  it('accepts a pending, unexpired invitation', () => {
    expect(isInvitationValid(invitation())).toEqual({ valid: true });
  });

  it('rejects revoked, accepted and expired invitations', () => {
    expect(isInvitationValid(invitation({ status: 'revoked' })).valid).toBe(false);
    expect(isInvitationValid(invitation({ status: 'accepted' })).valid).toBe(false);
    expect(
      isInvitationValid(invitation({ expiresAt: new Date(Date.now() - 1000).toISOString() })).valid
    ).toBe(false);
  });
});

describe('calculateExpirationDate', () => {
  it('returns an ISO date the given number of days ahead', () => {
    const inSeven = new Date(calculateExpirationDate(7)).getTime();
    const expected = Date.now() + 7 * 86_400_000;
    expect(Math.abs(inSeven - expected)).toBeLessThan(5_000);
  });
});

describe('invitationRedirectUrl', () => {
  it('maps every invitation role to its home page', () => {
    expect(invitationRedirectUrl('admin')).toBe('/admin');
    expect(invitationRedirectUrl('judge')).toBe('/judge');
    expect(invitationRedirectUrl('participant')).toBe('/participant');
    expect(invitationRedirectUrl('unknown')).toBe('/');
  });
});

describe('getExistingInvitation', () => {
  it('looks up a pending invitation by organization and email ignoring case', async () => {
    const pending = invitation();
    const select = buildAssertableSelectMock([pending]);
    vi.mocked(db.select).mockReturnValue(select.selectMock);

    const found = await getExistingInvitation('JUDGE@example.com', 'org-1');

    expect(found).toBe(pending);
    const condition = select.chain.where.mock.calls[0][0] as SQL;
    const { sql, params } = new PgDialect().sqlToQuery(condition);
    expect(sql).toMatch(/lower\("invitations"\."email"\) = lower\(\$1\)/);
    expect(sql).toMatch(/"invitations"\."organization_id" = \$2/);
    expect(sql).toMatch(/"invitations"\."status" = \$3/);
    expect(params).toEqual(['JUDGE@example.com', 'org-1', 'pending']);
  });
});

describe('finalizeInvitationAcceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(db as never));
  });

  function mockAccept() {
    // acceptInvitation re-reads the invitation, then updates it
    mockSelectSequence(vi.mocked(db.select), [invitation()]);
    const update = buildAssertableMutationMock([]);
    vi.mocked(db.update).mockReturnValue(
      update.insertMock as unknown as ReturnType<typeof db.update>
    );
    return update;
  }

  it('creates the profile row, the judge membership, and marks the invitation accepted', async () => {
    const insert = buildAssertableMutationMock([]);
    vi.mocked(db.insert).mockReturnValue(insert.insertMock);
    const update = mockAccept();

    const result = await finalizeInvitationAcceptance(invitation(), 'auth-1');

    expect(result).toEqual({ redirectUrl: '/judge' });
    expect(insert.chain.values).toHaveBeenNthCalledWith(1, {
      id: 'auth-1',
      email: 'Judge@Example.com',
      role: 'judge',
      organizationId: null,
    });
    expect(insert.chain.values).toHaveBeenNthCalledWith(2, {
      organizationId: 'org-1',
      userId: 'auth-1',
    });
    expect(update.chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted' }));
  });

  it('runs the profile insert, the membership and the acceptance in one transaction', async () => {
    const insert = buildAssertableMutationMock([]);
    vi.mocked(db.insert).mockReturnValue(insert.insertMock);
    mockAccept();

    await finalizeInvitationAcceptance(invitation(), 'auth-1');

    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it('gives admin invites the organization on the profile row and no membership', async () => {
    const insert = buildAssertableMutationMock([]);
    vi.mocked(db.insert).mockReturnValue(insert.insertMock);
    mockAccept();

    const result = await finalizeInvitationAcceptance(
      invitation({ role: 'admin', email: 'admin@example.com' }),
      'auth-2'
    );

    expect(result).toEqual({ redirectUrl: '/admin' });
    expect(insert.chain.values).toHaveBeenCalledTimes(1);
    expect(insert.chain.values).toHaveBeenCalledWith({
      id: 'auth-2',
      email: 'admin@example.com',
      role: 'admin',
      organizationId: 'org-1',
    });
  });
});

describe('acceptInvitationForExistingUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a judge to a new organization and accepts the invitation', async () => {
    // membership lookup (none), then acceptInvitation's re-read
    mockSelectSequence(vi.mocked(db.select), [], [invitation()]);
    const insert = buildAssertableMutationMock([]);
    vi.mocked(db.insert).mockReturnValue(insert.insertMock);
    const update = buildAssertableMutationMock([]);
    vi.mocked(db.update).mockReturnValue(
      update.insertMock as unknown as ReturnType<typeof db.update>
    );

    const result = await acceptInvitationForExistingUser(invitation(), {
      id: 'user-1',
      role: 'judge',
    });

    expect(result.accepted).toBe(true);
    expect(result.redirectUrl).toBe('/judge');
    expect(insert.chain.values).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'user-1' });
    expect(update.chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted' }));
  });

  it('refuses when the judge is already a member', async () => {
    vi.mocked(db.select).mockReturnValue(buildSelectMock([{ id: 'm-1' }]));

    const result = await acceptInvitationForExistingUser(invitation(), {
      id: 'user-1',
      role: 'judge',
    });

    expect(result.accepted).toBe(false);
    expect(result.message).toMatch(/already a member/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('refuses role changes and non-judge invites without touching the database', async () => {
    const asAdmin = await acceptInvitationForExistingUser(invitation({ role: 'admin' }), {
      id: 'user-1',
      role: 'judge',
    });
    expect(asAdmin).toMatchObject({ accepted: false, redirectUrl: '/judge' });

    const participant = await acceptInvitationForExistingUser(invitation(), {
      id: 'user-2',
      role: 'participant',
    });
    expect(participant).toMatchObject({ accepted: false, redirectUrl: '/participant' });

    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
