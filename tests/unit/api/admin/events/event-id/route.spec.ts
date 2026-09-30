import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT, DELETE } from '@/app/api/admin/events/[eventId]/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
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
  scopeToOrg,
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
const params = mockParams({ eventId: 'event-1' });

function put(body: unknown) {
  return PUT(mockRequest('/api/admin/events/event-1', { method: 'PUT', body }), params);
}

function del() {
  return DELETE(mockRequest('/api/admin/events/event-1', { method: 'DELETE' }), params);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
});

describe('PUT /api/admin/events/[eventId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await put({ name: 'X' }), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await put({ name: 'X' }), 403, 'FORBIDDEN');
  });

  it('404 for an event of another organization', async () => {
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await put({ name: 'X' }), 404, 'NOT_FOUND');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('400 without a name', async () => {
    await expectApiError(await put({ name: '  ' }), 400, 'BAD_REQUEST');
  });

  it('400 INVALID_STATUS for a status outside the enum', async () => {
    await expectApiError(await put({ name: 'X', status: 'archived' }), 400, 'INVALID_STATUS');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('refuses completed → setup', async () => {
    mockSelectSequence(dbMock.select, [{ status: 'completed' }]);
    const body = await expectApiError(
      await put({ name: 'X', status: 'setup' }),
      400,
      'INVALID_STATUS'
    );
    expect(body.error).toMatch(/cannot go back to setup/);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('404 when the event no longer exists', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await put({ name: 'X' }), 404, 'NOT_FOUND');
  });

  it('leaves the status untouched when the body omits it', async () => {
    mockSelectSequence(dbMock.select, [{ status: 'open' }]);
    const update = buildAssertableMutationMock([{ id: 'event-1', name: 'X', status: 'open' }]);
    dbMock.update.mockReturnValue(update.insertMock);

    const body = await expectJson<{ event: { status: string } }>(await put({ name: ' X ' }));

    expect(body.event.status).toBe('open');
    expect(update.chain.set).toHaveBeenCalledWith({ name: 'X' });
    expect(update.chain.set.mock.calls[0][0]).not.toHaveProperty('status');
  });

  it('changes only the fields the body carries (a status-only PUT keeps description and size)', async () => {
    mockSelectSequence(dbMock.select, [{ status: 'setup' }]);
    const update = buildAssertableMutationMock([{ id: 'event-1', name: 'X', status: 'open' }]);
    dbMock.update.mockReturnValue(update.insertMock);

    await expectJson(await put({ name: 'X', status: 'open' }));

    const values = update.chain.set.mock.calls[0][0];
    expect(values).toEqual({ name: 'X', status: 'open' });
    expect(values).not.toHaveProperty('description');
    expect(values).not.toHaveProperty('maxTeamSize');
  });

  it.each([
    ['a string', 'abc'],
    ['zero', 0],
    ['a fraction', 2.5],
    ['a negative number', -1],
  ])('400 when maxTeamSize is %s', async (_label, maxTeamSize) => {
    mockSelectSequence(dbMock.select, [{ status: 'setup' }]);
    await expectApiError(await put({ name: 'X', maxTeamSize }), 400, 'BAD_REQUEST');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('accepts null maxTeamSize (unlimited) and clears the description with an empty string', async () => {
    mockSelectSequence(dbMock.select, [{ status: 'setup' }]);
    const update = buildAssertableMutationMock([{ id: 'event-1', name: 'X', status: 'setup' }]);
    dbMock.update.mockReturnValue(update.insertMock);

    await expectJson(await put({ name: 'X', maxTeamSize: null, description: '  ' }));

    expect(update.chain.set).toHaveBeenCalledWith({
      name: 'X',
      maxTeamSize: null,
      description: null,
    });
  });

  it('updates the status when the body names a valid one', async () => {
    mockSelectSequence(dbMock.select, [{ status: 'setup' }]);
    const update = buildAssertableMutationMock([{ id: 'event-1', name: 'X', status: 'open' }]);
    dbMock.update.mockReturnValue(update.insertMock);

    const body = await expectJson<{ event: { status: string } }>(
      await put({ name: 'X', status: 'open', maxTeamSize: 4, description: ' d ' })
    );

    expect(body.event.status).toBe('open');
    expect(update.chain.set).toHaveBeenCalledWith({
      name: 'X',
      description: 'd',
      status: 'open',
      maxTeamSize: 4,
    });
  });
});

describe('DELETE /api/admin/events/[eventId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await del(), 401, 'UNAUTHORIZED');
  });

  it('403 for a participant', async () => {
    signInAs(auth, fakeUser('participant'));
    await expectApiError(await del(), 403, 'FORBIDDEN');
  });

  it('404 for an event of another organization', async () => {
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await del(), 404, 'NOT_FOUND');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('404 when the event does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await del(), 404, 'NOT_FOUND');
  });

  it.each(['open', 'active', 'completed'])('400 INVALID_STATUS for a %s event', async (status) => {
    mockSelectSequence(dbMock.select, [{ status }]);
    const body = await expectApiError(await del(), 400, 'INVALID_STATUS');
    expect(body.error).toBe('Only events in setup can be deleted');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('deletes an event in setup', async () => {
    mockSelectSequence(dbMock.select, [{ status: 'setup' }]);
    const remove = buildAssertableMutationMock([]);
    dbMock.delete.mockReturnValue(remove.insertMock);

    const body = await expectJson(await del());

    expect(body).toEqual({ success: true });
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
  });
});
