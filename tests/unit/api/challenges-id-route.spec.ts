import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, OPTIONS } from '@/app/api/challenges/[id]/route';
import { db } from '@/lib/db';
import { mockRequest, mockParams } from '../test-utils/mock-request';
import { buildSelectMock } from '../test-utils/mock-db';

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn() },
}));

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';

function mockChallengeQuery(result: unknown[]) {
  vi.mocked(db.select).mockReturnValue(buildSelectMock(result));
}

describe('GET /api/challenges/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for a non-UUID id without querying the database', async () => {
    const req = mockRequest('/api/challenges/not-a-uuid');
    const res = await GET(req, mockParams({ id: 'not-a-uuid' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid challenge ID format' });
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns 404 when no challenge matches the id', async () => {
    mockChallengeQuery([]);
    const req = mockRequest(`/api/challenges/${VALID_ID}`);
    const res = await GET(req, mockParams({ id: VALID_ID }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Challenge not found' });
  });

  it('returns 404 when the matching event is still in setup status', async () => {
    mockChallengeQuery([{ id: VALID_ID, status: 'setup', title: 'Hidden Challenge' }]);
    const req = mockRequest(`/api/challenges/${VALID_ID}`);
    const res = await GET(req, mockParams({ id: VALID_ID }));

    expect(res.status).toBe(404);
  });

  it('returns 200 with a shaped challenge payload on success', async () => {
    mockChallengeQuery([
      {
        id: VALID_ID,
        status: 'active',
        organizationId: 'org-1',
        title: 'AgriTech Challenge',
        shortDescription: 'Build something great',
        coverImageUrl: 'https://example.com/cover.png',
        challengeType: 'regional',
        tags: ['agritech'],
        prize: '$5,000',
        deadline: '2026-12-01',
        country: 'CA',
        participantSignupUrl: null,
        teamsRegisteredCount: 3,
      },
    ]);
    const req = mockRequest(`/api/challenges/${VALID_ID}`);
    const res = await GET(req, mockParams({ id: VALID_ID }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.challenge).toMatchObject({
      id: VALID_ID,
      title: 'AgriTech Challenge',
      short_description: 'Build something great',
      challenge_type: 'regional',
      teams_registered_count: 3,
      country: 'CA',
    });
    // Falls back to a generated signup URL when none is stored
    expect(json.challenge.participant_signup_url).toContain(`/participant/event/${VALID_ID}`);
  });

  it('defaults challenge_type to "global" when not set', async () => {
    mockChallengeQuery([
      {
        id: VALID_ID,
        status: 'active',
        title: 'No Type Challenge',
        challengeType: null,
        tags: null,
        teamsRegisteredCount: 0,
      },
    ]);
    const req = mockRequest(`/api/challenges/${VALID_ID}`);
    const res = await GET(req, mockParams({ id: VALID_ID }));
    const json = await res.json();

    expect(json.challenge.challenge_type).toBe('global');
    expect(json.challenge.tags).toEqual([]);
  });

  it('returns 500 when the database query throws', async () => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error('connection lost');
    });
    const req = mockRequest(`/api/challenges/${VALID_ID}`);
    const res = await GET(req, mockParams({ id: VALID_ID }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
  });

  it('includes CORS headers on the response', async () => {
    mockChallengeQuery([]);
    const req = mockRequest(`/api/challenges/${VALID_ID}`, {
      headers: { origin: 'https://partner.example.com' },
    });
    const res = await GET(req, mockParams({ id: VALID_ID }));

    expect(res.headers.get('Vary')).toBe('Origin');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET,OPTIONS');
  });
});

describe('OPTIONS /api/challenges/:id', () => {
  it('returns 204 with CORS headers for preflight requests', async () => {
    const req = mockRequest(`/api/challenges/${VALID_ID}`, { method: 'OPTIONS' });
    const res = await OPTIONS(req);

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET,OPTIONS');
  });
});
