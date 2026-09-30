import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/admin/criteria/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
import { db } from '@/lib/db';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import {
  buildAssertableMutationMock,
  buildFailingMutationMock,
  mockSelectSequence,
  resetDbMock,
  type DbMock,
} from '@/tests/unit/test-utils/mock-db';
import {
  fakeUser,
  signInAs,
  signOut,
  scopeToOrg,
  uniqueViolation,
  expectApiError,
  expectJson,
  type AuthServerMock,
  type OrgMock,
} from '@/tests/unit/test-utils/route-harness';

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

const auth = authServer as unknown as AuthServerMock;
const orgMock = org as unknown as OrgMock;
const dbMock = db as unknown as DbMock;

const valid = {
  eventId: 'event-1',
  name: 'QA-Tech-Merit',
  minScore: 1,
  maxScore: 10,
  weight: 40,
  category: 'technical',
};
const get = (query = '?eventId=event-1') => GET(mockRequest(`/api/admin/criteria${query}`));
const post = (body: unknown) => POST(mockRequest('/api/admin/criteria', { method: 'POST', body }));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
});

describe('GET /api/admin/criteria', () => {
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

  it('lists the event’s criteria', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'c1', name: 'QA-Tech-Merit' }]);
    expect(await expectJson(await get())).toEqual({
      criteria: [{ id: 'c1', name: 'QA-Tech-Merit' }],
    });
  });

  it('lists every criterion of the organization without an eventId', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'c1' }, { id: 'c2' }]);
    const body = await expectJson<{ criteria: unknown[] }>(await get(''));
    expect(body.criteria).toHaveLength(2);
    expect(orgMock.requireEventInOrg).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/criteria', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post(valid), 401, 'UNAUTHORIZED');
  });

  it('403 for a participant', async () => {
    signInAs(auth, fakeUser('participant'));
    await expectApiError(await post(valid), 403, 'FORBIDDEN');
  });

  it('404 for an event of another organization', async () => {
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await post(valid), 404, 'NOT_FOUND');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['no eventId', { ...valid, eventId: undefined }],
    ['empty name', { ...valid, name: ' ' }],
    ['non-numeric scores', { ...valid, minScore: '1' }],
    ['fractional scores', { ...valid, maxScore: 9.5 }],
    ['min >= max', { ...valid, minScore: 5, maxScore: 3 }],
    ['weight above 100', { ...valid, weight: 101 }],
    ['fractional weight', { ...valid, weight: 12.5 }],
    ['unknown category', { ...valid, category: 'design' }],
  ])('400 for %s', async (_label, body) => {
    await expectApiError(await post(body), 400, 'BAD_REQUEST');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it.each(['active', 'completed'])('400 INVALID_STATUS when the event is %s', async (status) => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', status }], []);
    dbMock.insert.mockReturnValue(buildAssertableMutationMock([{ id: 'c1' }]).insertMock);
    const body = await expectApiError(await post(valid), 400, 'INVALID_STATUS');
    expect(body.error).toBe('Criteria cannot be changed once judging has started');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('400 when the category weights would exceed 100', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'event-1', status: 'open' }],
      [{ id: 'c1', category: 'technical', weight: 70, displayOrder: 1 }]
    );
    const body = await expectApiError(await post({ ...valid, weight: 40 }), 400, 'BAD_REQUEST');
    expect(body.error).toMatch(/would total 110%/);
  });

  it('creates the criterion with the next display order under the event lock', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'event-1', status: 'open' }],
      [{ id: 'c1', category: 'business', weight: 30, displayOrder: 3 }]
    );
    const insert = buildAssertableMutationMock([{ id: 'c2', name: 'QA-Tech-Merit' }]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson(await post(valid), 201);

    expect(body).toEqual({ criterion: { id: 'c2', name: 'QA-Tech-Merit' } });
    // two admins adding criteria at once are serialised on the event, so the
    // display-order read, the weight check and the insert share one transaction
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    const lockCall = (dbMock.execute.mock.calls as unknown[][])[0];
    const lock = JSON.stringify((lockCall[0] as { queryChunks: unknown[] }).queryChunks);
    expect(lock).toContain('pg_advisory_xact_lock(hashtext(');
    expect(dbMock.transaction.mock.invocationCallOrder[0]).toBeLessThan(
      dbMock.insert.mock.invocationCallOrder[0]
    );
    expect(insert.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-1', displayOrder: 4, weight: 40 })
    );
  });

  it('400 DUPLICATE_CRITERION_NAME on the unique name violation (either constraint name)', async () => {
    for (const constraint of ['criteria_event_id_name_key', 'criteria_event_id_name_unique']) {
      mockSelectSequence(dbMock.select, [{ id: 'event-1', status: 'open' }], []);
      dbMock.insert.mockReturnValue(buildFailingMutationMock(uniqueViolation(constraint)));
      const body = await expectApiError(await post(valid), 400, 'DUPLICATE_CRITERION_NAME');
      expect(body.error).toBe('A criterion with this name already exists');
    }
  });

  it('409 on a display-order collision', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', status: 'open' }], []);
    dbMock.insert.mockReturnValue(
      buildFailingMutationMock(uniqueViolation('criteria_event_id_display_order_unique'))
    );
    await expectApiError(await post(valid), 409, 'CONFLICT');
  });
});
