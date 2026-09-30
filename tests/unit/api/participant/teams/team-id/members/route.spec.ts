import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/participant/teams/[teamId]/members/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireTeamMembership } from '@/lib/auth/participant';
import { mockRequest, mockParams } from '@/tests/unit/test-utils/mock-request';
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
vi.mock('@/lib/auth/participant', () => ({ requireTeamMembership: vi.fn() }));

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;
const get = () =>
  GET(mockRequest('/api/participant/teams/t1/members'), mockParams({ teamId: 't1' }));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('participant'));
  vi.mocked(requireTeamMembership).mockResolvedValue({
    id: 'm-1',
    isCreator: false,
    teamId: 't1',
    participantId: 'participant-1',
    joinedAt: 'x',
  });
});

describe('GET /api/participant/teams/[teamId]/members', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('403 NOT_MEMBER for a non-member', async () => {
    vi.mocked(requireTeamMembership).mockRejectedValue(new Error('NOT_MEMBER'));
    await expectApiError(await get(), 403, 'NOT_MEMBER');
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('lists the members with their email', async () => {
    const members = [
      { id: 'm-1', participantId: 'p1', email: 'a@example.com', isCreator: true, joinedAt: 'x' },
    ];
    mockSelectSequence(dbMock.select, members);
    expect(await expectJson(await get())).toEqual({ members });
  });
});
