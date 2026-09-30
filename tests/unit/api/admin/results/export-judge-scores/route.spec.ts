import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/results/export-judge-scores/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
import { db } from '@/lib/db';
import { loadCountedScores, loadEventCriteria } from '@/lib/db/results';
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
import { CRITERIA, JUDGES, SCORES, TEAMS } from '@/tests/unit/test-utils/results-fixture';

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
  loadEventCriteria: vi.fn(),
}));

const auth = authServer as unknown as AuthServerMock;
const orgMock = org as unknown as OrgMock;
const dbMock = db as unknown as DbMock;

const get = (query = '?eventId=event-1') =>
  GET(mockRequest(`/api/admin/results/export-judge-scores${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
  // teams, judges, event name (the counted scores and criteria come from the loader)
  mockSelectSequence(
    dbMock.select,
    Object.values(TEAMS),
    [JUDGES.j1, JUDGES.j2],
    [{ name: 'QA-Preflight' }]
  );
  vi.mocked(loadCountedScores).mockResolvedValue(SCORES);
  vi.mocked(loadEventCriteria).mockResolvedValue(CRITERIA);
});

describe('GET /api/admin/results/export-judge-scores', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for a participant', async () => {
    signInAs(auth, fakeUser('participant'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('404 for an event of another organization', async () => {
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await get(), 404, 'NOT_FOUND');
  });

  it('400 without an eventId', async () => {
    await expectApiError(await get(''), 400, 'BAD_REQUEST');
  });

  it('writes the judge × criterion matrix with N/A and blanks', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toMatch(
      /filename="judge-scores-matrix-qa-preflight-\d{4}-\d{2}-\d{2}\.csv"/
    );

    const lines = (await response.text()).trimEnd().split('\n');
    expect(lines[0]).toBe(
      'Team Name,Presentation Order,Award Type,judge1,judge1,judge1,judge1,judge2,judge2,judge2,judge2'
    );
    expect(lines[1]).toBe(
      ',,,QA-Tech-Merit (/10),QA-Innovation (/10),QA-Biz-Viability (/10),QA-Presentation (/10),' +
        'QA-Tech-Merit (/10),QA-Innovation (/10),QA-Biz-Viability (/10),QA-Presentation (/10)'
    );
    expect(lines[2]).toBe('QA-Alpha,1,Technical,8,6,N/A,N/A,7,9,N/A,N/A');
    expect(lines[3]).toBe('QA-Beta,2,Business,N/A,N/A,9,7,N/A,N/A,5,10');
    expect(lines[4]).toBe('"QA-Gamma ""Quoted"", Team",3,General,10,8,6,4,6,6,,');
    expect(lines[5]).toBe('QA-Delta,4,General,,,,,,,,');
    expect(lines).toHaveLength(6);
  });
});
