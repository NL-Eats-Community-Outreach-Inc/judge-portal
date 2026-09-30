import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/judge/event/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
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

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;

const get = (query = '') => GET(mockRequest(`/api/judge/event${query}`));
const one = { id: 'event-1', name: 'Live', status: 'active', organizationName: 'NL Eats' };
const two = { id: 'event-2', name: 'Other', status: 'active', organizationName: 'NL Eats' };

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('judge'));
});

describe('GET /api/judge/event', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for a participant', async () => {
    signInAs(auth, fakeUser('participant'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('returns null without an active assignment', async () => {
    mockSelectSequence(dbMock.select, []);
    expect(await expectJson(await get())).toEqual({ event: null });
  });

  it('auto-selects the single active event', async () => {
    mockSelectSequence(dbMock.select, [one]);
    expect(await expectJson(await get())).toEqual({ event: one });
  });

  it('returns the requested event when the judge is assigned to it', async () => {
    mockSelectSequence(dbMock.select, [one, two]);
    expect(await expectJson(await get('?eventId=event-2'))).toEqual({ event: two });
  });

  it('403 NOT_ASSIGNED for an event outside the assignments', async () => {
    mockSelectSequence(dbMock.select, [one]);
    await expectApiError(await get('?eventId=event-9'), 403, 'NOT_ASSIGNED');
  });

  it('400 SELECT_EVENT with several events and no selection', async () => {
    mockSelectSequence(dbMock.select, [one, two]);
    await expectApiError(await get(), 400, 'SELECT_EVENT');
  });
});
