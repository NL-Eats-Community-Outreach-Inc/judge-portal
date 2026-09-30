import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/results/export/route';
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
import { CRITERIA, SCORES } from '@/tests/unit/test-utils/results-fixture';

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

const get = (query = '?eventId=event-1') => GET(mockRequest(`/api/admin/results/export${query}`));

/** Splits one CSV line into fields, honouring quotes. */
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
  mockSelectSequence(dbMock.select, [{ name: 'QA Preflight' }]);
  vi.mocked(loadCountedScores).mockResolvedValue(SCORES);
  vi.mocked(loadEventCriteria).mockResolvedValue(CRITERIA);
});

describe('GET /api/admin/results/export', () => {
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

  it('400 without an eventId, or with an unknown mode or filter', async () => {
    await expectApiError(await get(''), 400, 'BAD_REQUEST');
    await expectApiError(await get('?eventId=event-1&scoreMode=median'), 400, 'BAD_REQUEST');
    await expectApiError(await get('?eventId=event-1&awardTypeFilter=x'), 400, 'BAD_REQUEST');
  });

  it('exports the total ranking as CSV with a dated filename and escaped fields', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/csv');
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="judging-results-qa-preflight-total-\d{4}-\d{2}-\d{2}\.csv"$/
    );

    const lines = (await response.text()).trimEnd().split('\n');
    expect(lines[0]).toBe(
      'Rank,Tied,Team Name,Award Type,Presentation Order,Total Score,Number of Scores,Judge Count'
    );
    expect(lines[1]).toBe('1,,"QA-Gamma ""Quoted"", Team",General,3,40,6,2');
    expect(parseLine(lines[1])).toEqual([
      '1',
      '',
      'QA-Gamma "Quoted", Team',
      'General',
      '3',
      '40',
      '6',
      '2',
    ]);
    expect(lines[2]).toBe('2,,QA-Beta,Business,2,31,4,2');
    expect(lines[3]).toBe('3,,QA-Alpha,Technical,1,30,4,2');
    expect(lines).toHaveLength(4);
  });

  it('ranks by the weighted score and prints it in the header', async () => {
    const lines = (await (await get('?eventId=event-1&scoreMode=weighted')).text())
      .trimEnd()
      .split('\n');
    expect(lines[0]).toContain('Weighted Score');
    expect(lines.slice(1).map((l) => parseLine(l).slice(2, 3).concat(parseLine(l)[5]))).toEqual([
      ['QA-Alpha', '7.5'],
      ['QA-Beta', '7.38'],
      ['QA-Gamma "Quoted", Team', '5.7'],
    ]);
  });

  it('applies the award-type filter', async () => {
    const lines = (await (await get('?eventId=event-1&awardTypeFilter=technical')).text())
      .trimEnd()
      .split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('1,,QA-Alpha,Technical,1,30,4,2');
  });

  it('M5: marks tied rows with yes in the Tied column, in the exported mode only', async () => {
    // judge 1 changes Alpha to C1 = 8, C2 = 7 on top of M1: Alpha 31 ties Beta 31
    vi.mocked(loadCountedScores).mockResolvedValue(
      SCORES.map((r) =>
        r.team.id === 'alpha' && r.judge.id === 'j1'
          ? { ...r, score: r.criterion.id === 'C1' ? 8 : 7 }
          : r
      )
    );
    const event = [{ name: 'QA Preflight' }];
    const total = (await (await get()).text()).trimEnd().split('\n');
    expect(total.slice(1)).toEqual([
      '1,,"QA-Gamma ""Quoted"", Team",General,3,40,6,2',
      '2,yes,QA-Alpha,Technical,1,31,4,2',
      '3,yes,QA-Beta,Business,2,31,4,2',
    ]);
    mockSelectSequence(dbMock.select, event);
    const average = (await (await get('?eventId=event-1&scoreMode=average')).text())
      .trimEnd()
      .split('\n');
    expect(average.slice(1).map((l) => parseLine(l).slice(0, 3))).toEqual([
      ['1', '', 'QA-Gamma "Quoted", Team'],
      ['2', 'yes', 'QA-Alpha'],
      ['3', 'yes', 'QA-Beta'],
    ]);
    mockSelectSequence(dbMock.select, event);
    const weighted = (await (await get('?eventId=event-1&scoreMode=weighted')).text())
      .trimEnd()
      .split('\n');
    expect(weighted.slice(1)).toEqual([
      '1,,QA-Alpha,Technical,1,7.67,4,2',
      '2,,QA-Beta,Business,2,7.38,4,2',
      '3,,"QA-Gamma ""Quoted"", Team",General,3,5.7,6,2',
    ]);
  });
});
