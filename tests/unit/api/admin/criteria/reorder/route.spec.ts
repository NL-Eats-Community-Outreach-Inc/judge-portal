import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/criteria/reorder/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
import { db } from '@/lib/db';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import {
  buildMutationMock,
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

const orders = [
  { id: 'c1', displayOrder: 2 },
  { id: 'c2', displayOrder: 1 },
];
const post = (body: unknown) =>
  POST(mockRequest('/api/admin/criteria/reorder', { method: 'POST', body }));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
  // the event status lookup; the guard cases queue their own
  mockSelectSequence(dbMock.select, [{ status: 'open' }]);
});

describe('POST /api/admin/criteria/reorder', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(
      await post({ eventId: 'event-1', criteriaOrders: orders }),
      401,
      'UNAUTHORIZED'
    );
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(
      await post({ eventId: 'event-1', criteriaOrders: orders }),
      403,
      'FORBIDDEN'
    );
  });

  it('404 for an event of another organization', async () => {
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(
      await post({ eventId: 'event-1', criteriaOrders: orders }),
      404,
      'NOT_FOUND'
    );
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['no eventId', { criteriaOrders: orders }],
    ['empty orders', { eventId: 'event-1', criteriaOrders: [] }],
    ['malformed entry', { eventId: 'event-1', criteriaOrders: [{ id: 'c1' }] }],
  ])('400 for %s', async (_label, body) => {
    await expectApiError(await post(body), 400, 'BAD_REQUEST');
  });

  it.each(['active', 'completed'])('400 INVALID_STATUS when the event is %s', async (status) => {
    mockSelectSequence(dbMock.select, [{ status }]);
    dbMock.update.mockImplementation(() => buildMutationMock([{ id: 'c' }]));
    const body = await expectApiError(
      await post({ eventId: 'event-1', criteriaOrders: orders }),
      400,
      'INVALID_STATUS'
    );
    expect(body.error).toBe('Criteria cannot be changed once judging has started');
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('writes the new order inside one transaction', async () => {
    let calls = 0;
    dbMock.update.mockImplementation(() => {
      calls += 1;
      // the first pass parks every row on a temporary order, the second returns the final rows
      return buildMutationMock(calls > orders.length ? [{ id: `c${calls - orders.length}` }] : []);
    });

    const body = await expectJson<{ updatedCriteria: unknown[] }>(
      await post({ eventId: 'event-1', criteriaOrders: orders })
    );

    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    expect(dbMock.update).toHaveBeenCalledTimes(orders.length * 2);
    expect(body.updatedCriteria).toHaveLength(2);
  });

  it('uses temporary orders that cannot collide with each other or a real order', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const three = [
      { id: 'c1', displayOrder: 3 },
      { id: 'c2', displayOrder: 1 },
      { id: 'c3', displayOrder: 2 },
    ];
    const chain = buildMutationMock([{ id: 'c' }]) as unknown as {
      set: ReturnType<typeof vi.fn>;
    };
    dbMock.update.mockReturnValue(chain as never);

    await expectJson(await post({ eventId: 'event-1', criteriaOrders: three }));

    const temporaries = chain.set.mock.calls
      .slice(0, three.length)
      .map(([values]) => (values as { displayOrder: number }).displayOrder);
    expect(new Set(temporaries).size).toBe(three.length);
    for (const value of temporaries) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeLessThan(1);
    }
  });

  it('400 when a row was not updated', async () => {
    dbMock.update.mockImplementation(() => buildMutationMock([]));
    await expectApiError(
      await post({ eventId: 'event-1', criteriaOrders: orders }),
      400,
      'BAD_REQUEST'
    );
  });

  it('409 on a display-order collision', async () => {
    dbMock.update.mockImplementation(() =>
      buildFailingMutationMock(uniqueViolation('criteria_event_id_display_order_key'))
    );
    await expectApiError(
      await post({ eventId: 'event-1', criteriaOrders: orders }),
      409,
      'CONFLICT'
    );
  });
});
