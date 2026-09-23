import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT, DELETE } from '@/app/api/admin/criteria/[criterionId]/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
import { db } from '@/lib/db';
import { mockRequest, mockParams } from '@/tests/unit/test-utils/mock-request';
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
const params = mockParams({ criterionId: 'c1' });

const current = {
  id: 'c1',
  eventId: 'event-1',
  name: 'QA-Tech-Merit',
  category: 'technical',
  weight: 40,
  displayOrder: 1,
};
// the lookup joins the event so the status guard needs no second query
const found = { ...current, eventStatus: 'open' };
const valid = {
  name: 'QA-Tech-Merit',
  minScore: 1,
  maxScore: 10,
  displayOrder: 1,
  weight: 40,
  category: 'technical',
};
const put = (body: unknown) =>
  PUT(mockRequest('/api/admin/criteria/c1', { method: 'PUT', body }), params);
const del = () => DELETE(mockRequest('/api/admin/criteria/c1', { method: 'DELETE' }), params);

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
});

describe('PUT /api/admin/criteria/[criterionId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await put(valid), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await put(valid), 403, 'FORBIDDEN');
  });

  it('404 when the criterion’s event belongs to another organization', async () => {
    mockSelectSequence(dbMock.select, [found]);
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await put(valid), 404, 'NOT_FOUND');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('404 when the criterion does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await put(valid), 404, 'NOT_FOUND');
  });

  it.each([
    ['empty name', { ...valid, name: '' }],
    ['min >= max', { ...valid, minScore: 10, maxScore: 10 }],
    ['fractional scores', { ...valid, minScore: 0.5 }],
    ['non-numeric display order', { ...valid, displayOrder: '1' }],
    ['display order below 1', { ...valid, displayOrder: 0 }],
    ['fractional display order', { ...valid, displayOrder: 1.5 }],
    ['negative weight', { ...valid, weight: -1 }],
    ['fractional weight', { ...valid, weight: 33.3 }],
    ['unknown category', { ...valid, category: 'x' }],
  ])('400 for %s', async (_label, body) => {
    await expectApiError(await put(body), 400, 'BAD_REQUEST');
  });

  it('400 when the other criteria plus the new weight exceed 100', async () => {
    mockSelectSequence(
      dbMock.select,
      [found],
      [current, { id: 'c2', category: 'technical', weight: 70 }]
    );
    const body = await expectApiError(await put({ ...valid, weight: 40 }), 400, 'BAD_REQUEST');
    expect(body.error).toMatch(/would total 110%/);
  });

  it.each(['active', 'completed'])(
    '400 INVALID_STATUS when the event is %s',
    async (eventStatus) => {
      mockSelectSequence(dbMock.select, [{ ...current, eventStatus }], [current]);
      dbMock.update.mockReturnValue(buildAssertableMutationMock([current]).insertMock);
      const body = await expectApiError(await put(valid), 400, 'INVALID_STATUS');
      expect(body.error).toBe('Criteria cannot be changed once judging has started');
      expect(dbMock.update).not.toHaveBeenCalled();
    }
  );

  it('updates the criterion', async () => {
    mockSelectSequence(dbMock.select, [found], [current]);
    const update = buildAssertableMutationMock([{ ...current, weight: 50 }]);
    dbMock.update.mockReturnValue(update.insertMock);

    const body = await expectJson(await put({ ...valid, weight: 50, description: ' d ' }));

    expect(body).toEqual({ criterion: { ...current, weight: 50 } });
    expect(update.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ weight: 50, description: 'd', name: 'QA-Tech-Merit' })
    );
  });

  it('400 DUPLICATE_CRITERION_NAME on the unique name violation', async () => {
    mockSelectSequence(dbMock.select, [found], [current]);
    dbMock.update.mockReturnValue(
      buildFailingMutationMock(uniqueViolation('criteria_event_id_name_unique'))
    );
    await expectApiError(await put({ ...valid, name: 'Other' }), 400, 'DUPLICATE_CRITERION_NAME');
  });

  it('400 DUPLICATE_DISPLAY_ORDER on the display-order violation', async () => {
    mockSelectSequence(dbMock.select, [found], [current]);
    dbMock.update.mockReturnValue(
      buildFailingMutationMock(uniqueViolation('criteria_event_id_display_order_key'))
    );
    await expectApiError(await put({ ...valid, displayOrder: 2 }), 400, 'DUPLICATE_DISPLAY_ORDER');
  });
});

describe('DELETE /api/admin/criteria/[criterionId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await del(), 401, 'UNAUTHORIZED');
  });

  it('403 for a participant', async () => {
    signInAs(auth, fakeUser('participant'));
    await expectApiError(await del(), 403, 'FORBIDDEN');
  });

  it('404 when the criterion’s event belongs to another organization', async () => {
    mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus: 'open' }]);
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await del(), 404, 'NOT_FOUND');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('404 when the criterion does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await del(), 404, 'NOT_FOUND');
  });

  it.each(['active', 'completed'])(
    '400 INVALID_STATUS when the event is %s',
    async (eventStatus) => {
      mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus }]);
      dbMock.delete.mockReturnValue(buildAssertableMutationMock([{ id: 'c1' }]).insertMock);
      const body = await expectApiError(await del(), 400, 'INVALID_STATUS');
      expect(body.error).toBe('Criteria cannot be changed once judging has started');
      expect(dbMock.delete).not.toHaveBeenCalled();
    }
  );

  it('deletes the criterion', async () => {
    mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus: 'open' }]);
    dbMock.delete.mockReturnValue(buildAssertableMutationMock([{ id: 'c1' }]).insertMock);
    expect(await expectJson(await del())).toEqual({ success: true });
  });
});
