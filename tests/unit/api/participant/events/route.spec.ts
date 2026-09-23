import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/participant/events/route';
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
  signInAs(auth, fakeUser('participant'));
});

describe('GET /api/participant/events', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await GET(), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await GET(), 403, 'FORBIDDEN');
  });

  it('flags the events the participant registered for', async () => {
    mockSelectSequence(dbMock.select, [
      {
        id: 'e1',
        name: 'Open',
        description: null,
        status: 'open',
        maxTeamSize: null,
        organizationName: 'NL Eats',
        createdAt: 'x',
        registrationId: 'r1',
        registeredAt: 'y',
      },
      {
        id: 'e2',
        name: 'Active',
        description: null,
        status: 'active',
        maxTeamSize: 4,
        organizationName: 'NL Eats',
        createdAt: 'x',
        registrationId: null,
        registeredAt: null,
      },
    ]);

    const body = await expectJson<{ events: Array<Record<string, unknown>> }>(await GET());

    expect(body.events.map((e) => [e.id, e.isRegistered])).toEqual([
      ['e1', true],
      ['e2', false],
    ]);
    expect(body.events[0]).not.toHaveProperty('registrationId');
  });
});
