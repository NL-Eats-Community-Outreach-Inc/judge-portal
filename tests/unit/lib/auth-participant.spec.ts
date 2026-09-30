import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import {
  requireTeamMembership,
  requireTeamCreator,
  requireTeamEventOpen,
  requireEventRegistration,
} from '@/lib/auth/participant';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';

vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});

const dbMock = db as unknown as DbMock;
const member = { id: 'm-1', isCreator: false, teamId: 't1', participantId: 'p1', joinedAt: 'x' };

beforeEach(() => resetDbMock(dbMock));

describe('requireTeamMembership', () => {
  it('returns the membership row', async () => {
    mockSelectSequence(dbMock.select, [member]);
    expect(await requireTeamMembership('t1', 'p1')).toEqual(member);
  });

  it('throws NOT_MEMBER otherwise', async () => {
    mockSelectSequence(dbMock.select, []);
    await expect(requireTeamMembership('t1', 'p1')).rejects.toThrow('NOT_MEMBER');
  });
});

describe('requireTeamCreator', () => {
  it('throws NOT_CREATOR for a plain member and NOT_MEMBER for a stranger', async () => {
    mockSelectSequence(dbMock.select, [member]);
    await expect(requireTeamCreator('t1', 'p1')).rejects.toThrow('NOT_CREATOR');
    mockSelectSequence(dbMock.select, []);
    await expect(requireTeamCreator('t1', 'p1')).rejects.toThrow('NOT_MEMBER');
  });

  it('returns the row for the creator', async () => {
    mockSelectSequence(dbMock.select, [{ ...member, isCreator: true }]);
    expect(await requireTeamCreator('t1', 'p1')).toMatchObject({ isCreator: true });
  });
});

describe('requireTeamEventOpen', () => {
  it('throws TEAM_NOT_FOUND and EVENT_NOT_OPEN', async () => {
    mockSelectSequence(dbMock.select, []);
    await expect(requireTeamEventOpen('t1')).rejects.toThrow('TEAM_NOT_FOUND');
    for (const eventStatus of ['setup', 'active', 'completed']) {
      mockSelectSequence(dbMock.select, [{ teamId: 't1', eventId: 'e1', eventStatus }]);
      await expect(requireTeamEventOpen('t1')).rejects.toThrow('EVENT_NOT_OPEN');
    }
  });

  it('returns the team and event details while open', async () => {
    const row = {
      teamId: 't1',
      eventId: 'e1',
      eventStatus: 'open',
      eventName: 'QA',
      maxTeamSize: 3,
    };
    mockSelectSequence(dbMock.select, [row]);
    expect(await requireTeamEventOpen('t1')).toEqual(row);
  });
});

describe('requireEventRegistration', () => {
  it('returns the registration or throws NOT_REGISTERED', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'r1' }]);
    expect(await requireEventRegistration('e1', 'p1')).toEqual({ id: 'r1' });
    mockSelectSequence(dbMock.select, []);
    await expect(requireEventRegistration('e1', 'p1')).rejects.toThrow('NOT_REGISTERED');
  });
});
