import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/results/export-comments/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
import { db } from '@/lib/db';
import { loadCountedScores } from '@/lib/db/results';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';
import {
  fakeUser,
  signInAs,
  signOut,
  scopeToOrg,
  expectApiError,
  type AuthServerMock,
  type OrgMock,
} from '@/tests/unit/test-utils/route-harness';
import { SCORES } from '@/tests/unit/test-utils/results-fixture';

vi.mock('@/lib/auth', async () => {
  const { buildAuthServerMock } = await import('@/tests/unit/test-utils/route-harness');
  return { authServer: buildAuthServerMock() };
});
vi.mock('@/lib/auth/org', async () => {
  const { buildOrgMock } = await import('@/tests/unit/test-utils/route-harness');
  return buildOrgMock();
});
vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});
vi.mock('@/lib/db/results', () => ({
  loadCountedScores: vi.fn(),
}));

const auth = authServer as unknown as AuthServerMock;
const orgMock = org as unknown as OrgMock;
const dbMock = db as unknown as DbMock;

const get = (query = '?eventId=event-1') =>
  GET(mockRequest(`/api/admin/results/export-comments${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
  mockSelectSequence(dbMock.select, [{ name: 'QA-Preflight' }]);
  vi.mocked(loadCountedScores).mockResolvedValue(SCORES);
});

describe('GET /api/admin/results/export-comments', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('404 for an event of another organization', async () => {
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await get(), 404, 'NOT_FOUND');
  });

  it('400 without an eventId', async () => {
    await expectApiError(await get(''), 400, 'BAD_REQUEST');
  });

  it('writes one row per counted score, ordered by team, judge and criterion, with the comment escaped', async () => {
    // the loader returns rows in presentation then display order; shuffle them
    // and add a comment with a quote and a comma on Gamma C1 for judge 1
    const shuffled = [...SCORES]
      .reverse()
      .map((row) =>
        row.team.id === 'gamma' && row.judge.id === 'j1' && row.criterion.id === 'C1'
          ? { ...row, comment: 'Solid "demo", well argued' }
          : row
      );
    vi.mocked(loadCountedScores).mockResolvedValue(shuffled);

    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/csv');
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="judging-comments-qa-preflight-\d{4}-\d{2}-\d{2}\.csv"$/
    );

    const lines = (await response.text()).trimEnd().split('\n');
    expect(lines[0]).toBe('Presentation Order,Team,Award Type,Judge,Criterion,Score,Comment');
    expect(lines).toHaveLength(1 + SCORES.length);
    expect(lines.slice(1, 5)).toEqual([
      '1,QA-Alpha,Technical,judge1@example.com,QA-Tech-Merit,8,',
      '1,QA-Alpha,Technical,judge1@example.com,QA-Innovation,6,',
      '1,QA-Alpha,Technical,judge2@example.com,QA-Tech-Merit,7,',
      '1,QA-Alpha,Technical,judge2@example.com,QA-Innovation,9,',
    ]);
    expect(lines[9]).toBe(
      '3,"QA-Gamma ""Quoted"", Team",General,judge1@example.com,QA-Tech-Merit,10,"Solid ""demo"", well argued"'
    );
    expect(lines[14]).toBe(
      '3,"QA-Gamma ""Quoted"", Team",General,judge2@example.com,QA-Innovation,6,'
    );
  });

  it('writes only the header when the event has no counted score', async () => {
    vi.mocked(loadCountedScores).mockResolvedValue([]);
    expect(await (await get()).text()).toBe(
      'Presentation Order,Team,Award Type,Judge,Criterion,Score,Comment\n'
    );
  });
});
