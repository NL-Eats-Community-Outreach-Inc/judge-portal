import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/mentors/route';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { mockRequest } from '../test-utils/mock-request';
import { buildSelectMock, buildAssertableSelectMock } from '../test-utils/mock-db';

vi.mock('@/lib/auth/server', () => ({
  getUserFromSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn() },
}));

function mockMentorsQuery(result: unknown[]) {
  vi.mocked(db.select).mockReturnValue(buildSelectMock(result));
}

describe('GET /api/admin/mentors', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when there is no session', async () => {
    vi.mocked(getUserFromSession).mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof getUserFromSession>>
    );
    const req = mockRequest('/api/admin/mentors');
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns 401 when the session user is not an admin', async () => {
    vi.mocked(getUserFromSession).mockResolvedValue({
      id: 'u1',
      role: 'judge',
    } as unknown as Awaited<ReturnType<typeof getUserFromSession>>);
    const req = mockRequest('/api/admin/mentors');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  describe('as an authenticated admin', () => {
    beforeEach(() => {
      vi.mocked(getUserFromSession).mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      } as unknown as Awaited<ReturnType<typeof getUserFromSession>>);
    });

    it('returns 400 for an invalid visibility filter', async () => {
      const req = mockRequest('/api/admin/mentors?visibility=bogus');
      const res = await GET(req);

      expect(res.status).toBe(400);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('returns mentors with the default pagination when no params are given', async () => {
      mockMentorsQuery([{ id: 'm1', fullName: 'Mentor One' }]);
      const req = mockRequest('/api/admin/mentors');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.mentors).toHaveLength(1);
    });

    it('accepts visibility=pending and visibility=approved', async () => {
      mockMentorsQuery([]);
      const pendingRes = await GET(mockRequest('/api/admin/mentors?visibility=pending'));
      expect(pendingRes.status).toBe(200);

      mockMentorsQuery([]);
      const approvedRes = await GET(mockRequest('/api/admin/mentors?visibility=approved'));
      expect(approvedRes.status).toBe(200);
    });

    it('clamps an out-of-range limit to the max allowed', async () => {
      const { selectMock, chain } = buildAssertableSelectMock([]);
      vi.mocked(db.select).mockReturnValue(selectMock);

      const req = mockRequest('/api/admin/mentors?limit=99999');
      await GET(req);

      expect(chain.limit).toHaveBeenCalledWith(200);
    });

    it('falls back to the default limit for a non-numeric limit param', async () => {
      const { selectMock, chain } = buildAssertableSelectMock([]);
      vi.mocked(db.select).mockReturnValue(selectMock);

      const req = mockRequest('/api/admin/mentors?limit=not-a-number');
      await GET(req);

      expect(chain.limit).toHaveBeenCalledWith(50);
    });

    it('falls back to offset 0 for a negative offset param', async () => {
      const { selectMock, chain } = buildAssertableSelectMock([]);
      vi.mocked(db.select).mockReturnValue(selectMock);

      const req = mockRequest('/api/admin/mentors?offset=-5');
      await GET(req);

      expect(chain.offset).toHaveBeenCalledWith(0);
    });

    it('returns 500 when the database query throws', async () => {
      vi.mocked(db.select).mockImplementation(() => {
        throw new Error('connection lost');
      });
      const req = mockRequest('/api/admin/mentors');
      const res = await GET(req);

      expect(res.status).toBe(500);
    });
  });
});
