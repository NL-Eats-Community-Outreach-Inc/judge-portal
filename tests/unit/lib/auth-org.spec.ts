import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import {
  getAdminOrgId,
  verifyEventInOrg,
  requireEventInOrg,
  OrphanedAdminError,
} from '@/lib/auth/org';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';

vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});

const dbMock = db as unknown as DbMock;

beforeEach(() => resetDbMock(dbMock));

describe('getAdminOrgId', () => {
  it('returns the organization of the admin', async () => {
    mockSelectSequence(dbMock.select, [{ organizationId: 'org-1' }]);
    expect(await getAdminOrgId('admin-1')).toBe('org-1');
  });

  it('throws OrphanedAdminError when the admin has no organization or no row', async () => {
    mockSelectSequence(dbMock.select, [{ organizationId: null }]);
    await expect(getAdminOrgId('admin-1')).rejects.toBeInstanceOf(OrphanedAdminError);
    mockSelectSequence(dbMock.select, []);
    await expect(getAdminOrgId('admin-1')).rejects.toBeInstanceOf(OrphanedAdminError);
  });

  it('names the error so handleRouteError can recognise it', () => {
    expect(new OrphanedAdminError().name).toBe('OrphanedAdminError');
  });
});

describe('verifyEventInOrg / requireEventInOrg', () => {
  it('is true only when the event belongs to the organization', async () => {
    mockSelectSequence(dbMock.select, [{ organizationId: 'org-1' }]);
    expect(await verifyEventInOrg('event-1', 'org-1')).toBe(true);
    mockSelectSequence(dbMock.select, [{ organizationId: 'org-2' }]);
    expect(await verifyEventInOrg('event-1', 'org-1')).toBe(false);
    mockSelectSequence(dbMock.select, []);
    expect(await verifyEventInOrg('missing', 'org-1')).toBe(false);
  });

  it('requireEventInOrg throws the message handleRouteError maps to 404', async () => {
    mockSelectSequence(dbMock.select, [{ organizationId: 'org-2' }]);
    await expect(requireEventInOrg('event-1', 'org-1')).rejects.toThrow(
      'Event does not belong to your organization'
    );
    mockSelectSequence(dbMock.select, [{ organizationId: 'org-1' }]);
    await expect(requireEventInOrg('event-1', 'org-1')).resolves.toBeUndefined();
  });
});
