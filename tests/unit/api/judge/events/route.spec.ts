import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/judge/events/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
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

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('judge'));
});

describe('GET /api/judge/events', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await GET(), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await GET(), 403, 'FORBIDDEN');
  });

  it('lists the judge’s active events with their organization name', async () => {
    const rows = [{ id: 'event-1', name: 'Live', status: 'active', organizationName: 'NL Eats' }];
    mockSelectSequence(dbMock.select, rows);
    expect(await expectJson(await GET())).toEqual({ events: rows });
  });

  it('500 with the envelope when the query fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    dbMock.select.mockImplementation(() => {
      throw new Error('boom');
    });
    await expectApiError(await GET(), 500, 'INTERNAL_SERVER_ERROR');
    spy.mockRestore();
  });
});
