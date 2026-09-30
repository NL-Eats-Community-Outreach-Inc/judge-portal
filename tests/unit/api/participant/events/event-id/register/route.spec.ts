import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, DELETE } from '@/app/api/participant/events/[eventId]/register/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockRequest, mockParams } from '@/tests/unit/test-utils/mock-request';
import {
  buildAssertableMutationMock,
  mockSelectSequence,
  resetDbMock,
  type DbMock,
} from '@/tests/unit/test-utils/mock-db';
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
const params = mockParams({ eventId: 'event-1' });

const post = () =>
  POST(mockRequest('/api/participant/events/event-1/register', { method: 'POST' }), params);
const del = () =>
  DELETE(mockRequest('/api/participant/events/event-1/register', { method: 'DELETE' }), params);

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('participant'));
});

describe('POST /api/participant/events/[eventId]/register', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await post(), 403, 'FORBIDDEN');
  });

  it('404 when the event does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await post(), 404, 'NOT_FOUND');
  });

  it.each(['setup', 'completed'])('400 when the event is %s', async (status) => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', status, name: 'QA' }]);
    await expectApiError(await post(), 400, 'BAD_REQUEST');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('registers the participant (201) for an open event', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', status: 'open', name: 'QA' }]);
    const insert = buildAssertableMutationMock([{ id: 'r1', eventId: 'event-1' }]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson(await post(), 201);

    expect(body).toEqual({ registration: { id: 'r1', eventId: 'event-1' } });
    expect(insert.chain.values).toHaveBeenCalledWith({
      eventId: 'event-1',
      participantId: 'participant-1',
    });
  });

  it('is idempotent: answers 200 with the existing registration', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'event-1', status: 'active', name: 'QA' }],
      [{ id: 'r1', eventId: 'event-1' }]
    );
    dbMock.insert.mockReturnValue(buildAssertableMutationMock([]).insertMock);

    const body = await expectJson(await post());

    expect(body).toEqual({
      registration: { id: 'r1', eventId: 'event-1' },
      message: 'Already registered',
    });
  });
});

describe('DELETE /api/participant/events/[eventId]/register', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await del(), 401, 'UNAUTHORIZED');
  });

  it('404 when the event does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await del(), 404, 'NOT_FOUND');
  });

  it('400 unless the event is open', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', status: 'active' }]);
    await expectApiError(await del(), 400, 'BAD_REQUEST');
  });

  it('400 while the participant is still on a team', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', status: 'open' }], [{ id: 'm-1' }]);
    const body = await expectApiError(await del(), 400, 'BAD_REQUEST');
    expect(body.error).toMatch(/leave your team/);
  });

  it('404 when there is no registration to remove', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', status: 'open' }], []);
    dbMock.delete.mockReturnValue(buildAssertableMutationMock([]).insertMock);
    await expectApiError(await del(), 404, 'NOT_FOUND');
  });

  it('removes the registration', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', status: 'open' }], []);
    dbMock.delete.mockReturnValue(buildAssertableMutationMock([{ id: 'r1' }]).insertMock);
    expect(await expectJson(await del())).toEqual({ success: true });
  });
});
