import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/auth/callback/route';
import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import {
  buildAssertableMutationMock,
  mockSelectSequence,
  resetDbMock,
  type DbMock,
} from '@/tests/unit/test-utils/mock-db';

vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }));

const dbMock = db as unknown as DbMock;
const exchangeCodeForSession = vi.fn();
const get = (query: string) => GET(mockRequest(`/api/auth/callback${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  vi.mocked(createClient).mockResolvedValue({
    auth: { exchangeCodeForSession },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  exchangeCodeForSession.mockResolvedValue({
    data: { user: { id: 'auth-1', email: 'new@example.com', user_metadata: {} } },
    error: null,
  });
});

describe('GET /api/auth/callback', () => {
  it('redirects to the error page without a code', async () => {
    const response = await get('');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/auth/error');
  });

  it('redirects to the error page when the exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: new Error('bad') });
    expect((await get('?code=abc')).headers.get('location')).toBe(
      'http://localhost:3000/auth/error'
    );
  });

  it('redirects an existing user to next without writing', async () => {
    mockSelectSequence(dbMock.select, [{ role: 'admin' }]);
    const response = await get('?code=abc&next=/admin');
    expect(response.headers.get('location')).toBe('http://localhost:3000/admin');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('creates the profile row and judge memberships from signup metadata', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'auth-1',
          email: 'new@example.com',
          user_metadata: {
            role: 'judge',
            organization_ids: ['org-1'],
          },
        },
      },
      error: null,
    });

    mockSelectSequence(dbMock.select, []);

    const userInsert = buildAssertableMutationMock([]);
    const roleInsert = buildAssertableMutationMock([]);
    const memberInsert = buildAssertableMutationMock([]);

    dbMock.insert
      .mockReturnValueOnce(userInsert.insertMock)
      .mockReturnValueOnce(roleInsert.insertMock)
      .mockReturnValueOnce(memberInsert.insertMock);

    const response = await get('?code=abc');

    expect(response.headers.get('location')).toBe('http://localhost:3000/judge');

    expect(userInsert.chain.values).toHaveBeenCalledWith({
      id: 'auth-1',
      email: 'new@example.com',
      role: 'judge',
    });

    expect(roleInsert.chain.values).toHaveBeenCalledWith({
      userId: 'auth-1',
      role: 'judge',
      grantedSource: 'self_signup',
    });

    expect(memberInsert.chain.values).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'auth-1',
    });
  });
});
