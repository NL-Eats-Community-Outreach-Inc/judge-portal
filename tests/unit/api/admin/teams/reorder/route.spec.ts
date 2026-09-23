import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/teams/reorder/route';
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
  { id: 't1', presentationOrder: 2 },
  { id: 't2', presentationOrder: 1 },
];
const post = (body: unknown) =>
  POST(mockRequest('/api/admin/teams/reorder', { method: 'POST', body }));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
  // the event status lookup; the guard cases queue their own
  mockSelectSequence(dbMock.select, [{ status: 'open' }]);
});

describe('POST /api/admin/teams/reorder', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(
      await post({ eventId: 'event-1', teamOrders: orders }),
      401,
      'UNAUTHORIZED'
    );
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await post({ eventId: 'event-1', teamOrders: orders }), 403, 'FORBIDDEN');
  });

  it('404 for an event of another organization', async () => {
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await post({ eventId: 'event-1', teamOrders: orders }), 404, 'NOT_FOUND');
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['no eventId', { teamOrders: orders }],
    ['empty orders', { eventId: 'event-1', teamOrders: [] }],
    ['malformed entry', { eventId: 'event-1', teamOrders: [{ id: 't1', presentationOrder: '1' }] }],
  ])('400 for %s', async (_label, body) => {
    await expectApiError(await post(body), 400, 'BAD_REQUEST');
  });

  it('400 INVALID_STATUS when the event is completed', async () => {
    mockSelectSequence(dbMock.select, [{ status: 'completed' }]);
    dbMock.update.mockImplementation(() => buildMutationMock([{ id: 't' }]));
    const body = await expectApiError(
      await post({ eventId: 'event-1', teamOrders: orders }),
      400,
      'INVALID_STATUS'
    );
    expect(body.error).toBe('The event is completed');
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('writes the new order inside one transaction', async () => {
    let calls = 0;
    dbMock.update.mockImplementation(() => {
      calls += 1;
      return buildMutationMock(calls > orders.length ? [{ id: `t${calls - orders.length}` }] : []);
    });

    const body = await expectJson<{ updatedTeams: unknown[] }>(
      await post({ eventId: 'event-1', teamOrders: orders })
    );

    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    expect(dbMock.update).toHaveBeenCalledTimes(orders.length * 2);
    expect(body.updatedTeams).toHaveLength(2);
  });

  it('uses temporary orders that cannot collide with each other or a real order', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const three = [
      { id: 't1', presentationOrder: 3 },
      { id: 't2', presentationOrder: 1 },
      { id: 't3', presentationOrder: 2 },
    ];
    const chain = buildMutationMock([{ id: 't' }]) as unknown as {
      set: ReturnType<typeof vi.fn>;
    };
    dbMock.update.mockReturnValue(chain as never);

    await expectJson(await post({ eventId: 'event-1', teamOrders: three }));

    const temporaries = chain.set.mock.calls
      .slice(0, three.length)
      .map(([values]) => (values as { presentationOrder: number }).presentationOrder);
    expect(new Set(temporaries).size).toBe(three.length);
    for (const value of temporaries) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeLessThan(1);
    }
  });

  it('400 when a row was not updated', async () => {
    dbMock.update.mockImplementation(() => buildMutationMock([]));
    await expectApiError(
      await post({ eventId: 'event-1', teamOrders: orders }),
      400,
      'BAD_REQUEST'
    );
  });

  it('409 on a presentation-order collision', async () => {
    dbMock.update.mockImplementation(() =>
      buildFailingMutationMock(uniqueViolation('teams_event_id_presentation_order_key'))
    );
    await expectApiError(await post({ eventId: 'event-1', teamOrders: orders }), 409, 'CONFLICT');
  });
});
