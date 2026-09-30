import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/submissions/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireTeamMembership } from '@/lib/auth/participant';
import * as config from '@/lib/config';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import {
  buildAssertableMutationMock,
  mockSelectSequence,
  resetDbMock,
  type DbMock,
} from '@/tests/unit/test-utils/mock-db';
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
vi.mock('@/lib/config', () => ({ SUBMISSIONS_ENABLED: false, EMAIL_FEATURES_ENABLED: false }));

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;
const flags = config as { SUBMISSIONS_ENABLED: boolean };
const valid = { teamId: 't1', submissionText: ' Our proposal ' };
const post = (body: unknown) => POST(mockRequest('/api/submissions', { method: 'POST', body }));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('participant'));
  vi.mocked(requireTeamMembership).mockResolvedValue({
    id: 'm-1',
    isCreator: true,
    teamId: 't1',
    participantId: 'participant-1',
    joinedAt: 'x',
  });
  delete process.env.AI_SCORING_URL;
});

afterEach(() => {
  flags.SUBMISSIONS_ENABLED = false;
  vi.unstubAllGlobals();
});

describe('POST /api/submissions', () => {
  it('404 FEATURE_DISABLED while the flag is off, before any auth check', async () => {
    signOut(auth);
    await expectApiError(await post(valid), 404, 'FEATURE_DISABLED');
    expect(auth.requireParticipant).not.toHaveBeenCalled();
  });

  describe('with the flag on', () => {
    beforeEach(() => {
      flags.SUBMISSIONS_ENABLED = true;
    });

    it('401 when unauthenticated', async () => {
      signOut(auth);
      await expectApiError(await post(valid), 401, 'UNAUTHORIZED');
    });

    it('403 for a judge', async () => {
      signInAs(auth, fakeUser('judge'));
      await expectApiError(await post(valid), 403, 'FORBIDDEN');
    });

    it('400 without a team or text', async () => {
      await expectApiError(await post({ submissionText: 'x' }), 400, 'BAD_REQUEST');
      await expectApiError(
        await post({ teamId: 't1', submissionText: '  ' }),
        400,
        'MISSING_SUBMISSION_TEXT'
      );
    });

    it('403 NOT_MEMBER for a non-member', async () => {
      vi.mocked(requireTeamMembership).mockRejectedValue(new Error('NOT_MEMBER'));
      await expectApiError(await post(valid), 403, 'NOT_MEMBER');
    });

    it('404 TEAM_NOT_FOUND and 400 EVENT_NOT_OPEN from the team lookup', async () => {
      mockSelectSequence(dbMock.select, []);
      await expectApiError(await post(valid), 404, 'TEAM_NOT_FOUND');
      mockSelectSequence(dbMock.select, [
        { eventId: 'e1', organizationId: 'org-1', eventStatus: 'active' },
      ]);
      await expectApiError(await post(valid), 400, 'EVENT_NOT_OPEN');
    });

    it('stores the trimmed text and returns without calling a scorer when none is configured', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      mockSelectSequence(
        dbMock.select,
        [{ eventId: 'e1', organizationId: 'org-1', eventStatus: 'open' }],
        []
      );
      const insert = buildAssertableMutationMock([{ id: 'sub-1' }]);
      dbMock.insert.mockReturnValue(insert.insertMock);

      expect(await expectJson(await post(valid))).toEqual({ success: true });
      expect(insert.chain.values).toHaveBeenCalledWith({
        eventId: 'e1',
        teamId: 't1',
        submissionText: 'Our proposal',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('replaces a previous submission and calls the scorer when AI_SCORING_URL is set', async () => {
      process.env.AI_SCORING_URL = 'http://scorer.test/score';
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchSpy);
      mockSelectSequence(
        dbMock.select,
        [{ eventId: 'e1', organizationId: 'org-1', eventStatus: 'open' }],
        [{ id: 'sub-0' }]
      );
      dbMock.delete.mockImplementation(() => buildAssertableMutationMock([]).insertMock);
      dbMock.insert.mockReturnValue(buildAssertableMutationMock([{ id: 'sub-1' }]).insertMock);

      expect(await expectJson(await post(valid))).toEqual({ success: true });
      expect(dbMock.delete).toHaveBeenCalledTimes(2);
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://scorer.test/score',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
