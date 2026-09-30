import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/organizations/public/route';
import { db } from '@/lib/db';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';
import { expectApiError, expectJson } from '@/tests/unit/test-utils/route-harness';

vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});

const dbMock = db as unknown as DbMock;

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
});

describe('GET /api/organizations/public', () => {
  it('lists organizations without authentication', async () => {
    const orgs = [{ id: 'org-1', name: 'NL Eats', slug: 'nl-eats', description: null }];
    mockSelectSequence(dbMock.select, orgs);
    expect(await expectJson(await GET())).toEqual({ organizations: orgs });
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
