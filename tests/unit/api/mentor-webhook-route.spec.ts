import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { POST } from '@/app/api/webhooks/learnworlds/mentor/route';
import { db } from '@/lib/db';
import { mockRequest } from '../test-utils/mock-request';
import { buildMutationMock, buildAssertableMutationMock } from '../test-utils/mock-db';

vi.mock('@/lib/db', () => ({
  db: { insert: vi.fn() },
}));

const WEBHOOK_SECRET = 'test-webhook-secret';

function signedRequest(payload: Record<string, unknown>, secret = WEBHOOK_SECRET) {
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  return mockRequest('/api/webhooks/learnworlds/mentor', {
    method: 'POST',
    body,
    headers: { 'x-lw-signature': signature },
  });
}

describe('POST /api/webhooks/learnworlds/mentor', () => {
  const originalSecret = process.env.LEARNWORLDS_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEARNWORLDS_WEBHOOK_SECRET = WEBHOOK_SECRET;
    vi.mocked(db.insert).mockReturnValue(buildMutationMock());
  });

  afterEach(() => {
    process.env.LEARNWORLDS_WEBHOOK_SECRET = originalSecret;
  });

  it('returns 500 when the webhook secret is not configured', async () => {
    delete process.env.LEARNWORLDS_WEBHOOK_SECRET;
    const req = signedRequest({ user_id: 'u1', tags: ['role_mentor'] });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('returns 401 when the signature is missing', async () => {
    const req = mockRequest('/api/webhooks/learnworlds/mentor', {
      method: 'POST',
      body: JSON.stringify({ user_id: 'u1', tags: ['role_mentor'] }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Invalid signature' });
  });

  it('returns 401 when the signature does not match the body', async () => {
    const req = signedRequest({ user_id: 'u1', tags: ['role_mentor'] }, 'wrong-secret');
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 400 when the body is not valid JSON', async () => {
    const body = 'not json';
    const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    const req = mockRequest('/api/webhooks/learnworlds/mentor', {
      method: 'POST',
      body,
      headers: { 'x-lw-signature': signature },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Malformed JSON' });
  });

  it('ignores payloads without the role_mentor tag', async () => {
    const req = signedRequest({ user_id: 'u1', tags: ['role_student'] });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Ignored: No mentor tag' });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('returns 400 when user_id is missing', async () => {
    const req = signedRequest({ tags: ['role_mentor'], name: 'No ID' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Missing user_id' });
  });

  it('upserts a mentor profile with mapped fields on a valid payload', async () => {
    const { insertMock, chain } = buildAssertableMutationMock();
    vi.mocked(db.insert).mockReturnValue(insertMock);

    const req = signedRequest({
      user_id: 'lw_123',
      name: 'Ada Lovelace',
      tags: ['role_mentor', 'mentor_ai'],
      cf_mentor_title: 'Engineer',
      cf_mentor_org: 'Analytical Engines Inc',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        learnworldsUserId: 'lw_123',
        fullName: 'Ada Lovelace',
        title: 'Engineer',
        organization: 'Analytical Engines Inc',
      })
    );
  });

  it('falls back to "Unknown" full name when name fields are absent', async () => {
    const { insertMock, chain } = buildAssertableMutationMock();
    vi.mocked(db.insert).mockReturnValue(insertMock);

    const req = signedRequest({ user_id: 'lw_456', tags: ['role_mentor'] });
    await POST(req);

    expect(chain.values).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Unknown' }));
  });

  it('returns 500 when the database call throws', async () => {
    vi.mocked(db.insert).mockImplementation(() => {
      throw new Error('db unavailable');
    });
    const req = signedRequest({ user_id: 'lw_789', tags: ['role_mentor'] });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
