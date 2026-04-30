import { test, expect } from '@playwright/test';

test.describe('GET /api/challenges endpoint', () => {
  const LEARNWORLDS_ORIGIN = process.env.LEARNWORLDS_ORIGIN ?? 'https://learnworlds.com';

  test('should return 200 with challenges in default open status', async ({ request }) => {
    const response = await request.get('/api/challenges');

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('challenges');
    expect(Array.isArray(data.challenges)).toBe(true);
  });

  test('should filter challenges by status query parameter', async ({ request }) => {
    // Test with status=active
    const responseActive = await request.get('/api/challenges?status=active');

    expect(responseActive.status()).toBe(200);
    const dataActive = await responseActive.json();
    expect(Array.isArray(dataActive.challenges)).toBe(true);

    // Test with status=completed
    const responseCompleted = await request.get('/api/challenges?status=completed');

    expect(responseCompleted.status()).toBe(200);
    const dataCompleted = await responseCompleted.json();
    expect(Array.isArray(dataCompleted.challenges)).toBe(true);
  });

  test('should return 400 error when invalid status provided', async ({ request }) => {
    const response = await request.get('/api/challenges?status=invalid');

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Invalid status parameter');
  });

  test('should have correct response shape for challenges', async ({ request }) => {
    const response = await request.get('/api/challenges');

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.challenges.length > 0) {
      const challenge = data.challenges[0];

      // Verify required fields
      expect(challenge).toHaveProperty('id');
      expect(challenge).toHaveProperty('title');
      expect(challenge).toHaveProperty('short_description');
      expect(challenge).toHaveProperty('cover_image_url');
      expect(challenge).toHaveProperty('challenge_type');
      expect(challenge).toHaveProperty('tags');
      expect(challenge).toHaveProperty('prize_amount');
      expect(challenge).toHaveProperty('deadline');
      expect(challenge).toHaveProperty('teams_registered_count');
      expect(challenge).toHaveProperty('participant_signup_url');

      // Verify field types
      expect(typeof challenge.id).toBe('string');
      expect(typeof challenge.title).toBe('string');
      expect(typeof challenge.challenge_type).toBe('string');
      expect(Array.isArray(challenge.tags)).toBe(true);
      expect(typeof challenge.teams_registered_count).toBe('number');
      expect(typeof challenge.participant_signup_url).toBe('string');
    }
  });

  test('should include team count aggregation', async ({ request }) => {
    const response = await request.get('/api/challenges');

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.challenges.length > 0) {
      const challenge = data.challenges[0];
      // teams_registered_count should be a number >= 0
      expect(typeof challenge.teams_registered_count).toBe('number');
      expect(challenge.teams_registered_count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should respond to OPTIONS preflight request with CORS headers', async ({ request }) => {
    const response = await request.fetch('/api/challenges', {
      method: 'OPTIONS',
      headers: {
        Origin: LEARNWORLDS_ORIGIN,
      },
    });

    expect(response.status()).toBe(204);
    expect(response.headers()).toHaveProperty('access-control-allow-methods');
    expect(response.headers()).toHaveProperty('access-control-allow-headers');
  });

  test('should include CORS headers in GET response from allowed origin', async ({ request }) => {
    const response = await request.get('/api/challenges', {
      headers: {
        Origin: LEARNWORLDS_ORIGIN,
      },
    });

    expect(response.status()).toBe(200);

    // CORS headers should be present
    const headers = response.headers();
    expect(headers).toHaveProperty('access-control-allow-origin');
    expect(headers).toHaveProperty('vary');
  });

  test('should support CORS from configured LearnWorlds origin', async ({ request }) => {
    const response = await request.fetch('/api/challenges', {
      method: 'OPTIONS',
      headers: {
        Origin: LEARNWORLDS_ORIGIN,
      },
    });

    expect(response.status()).toBe(204);
    const allowedOrigin = response.headers()['access-control-allow-origin'];
    // If LEARNWORLDS_ALLOWED_ORIGIN env is configured, it should match the request origin
    // Otherwise it might be 'null' or the allowed origin from env
    expect(allowedOrigin).toBeDefined();
  });

  test('should not require authentication (public endpoint)', async ({ request }) => {
    const response = await request.get('/api/challenges');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('challenges');
  });

  test('should allow both status query param formats', async ({ request }) => {
    // Test with spaces and trimming
    const response1 = await request.get('/api/challenges?status=%20open%20');

    expect(response1.status()).toBe(200);
    const data1 = await response1.json();
    expect(Array.isArray(data1.challenges)).toBe(true);

    const response2 = await request.get('/api/challenges?status=open');

    expect(response2.status()).toBe(200);
    const data2 = await response2.json();
    expect(Array.isArray(data2.challenges)).toBe(true);
  });

  test('should return participant signup URLs with correct format', async ({ request }) => {
    const response = await request.get('/api/challenges');

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.challenges.length > 0) {
      const challenge = data.challenges[0];
      expect(challenge.participant_signup_url).toMatch(/\/participant\/event\//);
      expect(challenge.participant_signup_url).toContain(challenge.id);
    }
  });

  test('should return 400 for setup status because it is not publicly exposed', async ({
    request,
  }) => {
    const response = await request.get('/api/challenges?status=setup');

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Invalid status parameter');
  });

  test('should include pagination metadata with defaults', async ({ request }) => {
    const response = await request.get('/api/challenges');

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('pagination');
    expect(data.pagination).toEqual(
      expect.objectContaining({
        limit: 50,
        offset: 0,
      })
    );
    expect(typeof data.pagination.count).toBe('number');
    expect(data.pagination.count).toBe(data.challenges.length);
  });

  test('should clamp limit and normalize offset pagination params', async ({ request }) => {
    const response = await request.get('/api/challenges?limit=999&offset=-8');

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('pagination');
    expect(data.pagination.limit).toBe(100);
    expect(data.pagination.offset).toBe(0);
  });

  test('should fallback pagination params when values are invalid', async ({ request }) => {
    const response = await request.get('/api/challenges?limit=abc&offset=xyz');

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('pagination');
    expect(data.pagination.limit).toBe(50);
    expect(data.pagination.offset).toBe(0);
  });

  test('should include country field in challenge payload', async ({ request }) => {
    const response = await request.get('/api/challenges');

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.challenges.length > 0) {
      const challenge = data.challenges[0];
      expect(challenge).toHaveProperty('country');
    }
  });
});

test.describe('GET /api/challenges/[id] endpoint', () => {
  const LEARNWORLDS_ORIGIN = process.env.LEARNWORLDS_ORIGIN ?? 'https://learnworlds.com';

  test('should return challenge detail for a valid challenge ID', async ({ request }) => {
    const listResponse = await request.get('/api/challenges');
    expect(listResponse.status()).toBe(200);

    const listData = await listResponse.json();
    if (!Array.isArray(listData.challenges) || listData.challenges.length === 0) {
      test.skip();
      return;
    }

    const challengeId = listData.challenges[0].id;
    const detailResponse = await request.get(`/api/challenges/${challengeId}`);

    expect(detailResponse.status()).toBe(200);
    const detailData = await detailResponse.json();
    expect(detailData).toHaveProperty('challenge');
    expect(detailData.challenge.id).toBe(challengeId);
  });

  test('should return snake_case fields in challenge detail response', async ({ request }) => {
    const listResponse = await request.get('/api/challenges');
    expect(listResponse.status()).toBe(200);

    const listData = await listResponse.json();
    if (!Array.isArray(listData.challenges) || listData.challenges.length === 0) {
      test.skip();
      return;
    }

    const challengeId = listData.challenges[0].id;
    const detailResponse = await request.get(`/api/challenges/${challengeId}`);

    expect(detailResponse.status()).toBe(200);
    const data = await detailResponse.json();

    expect(data.challenge).toHaveProperty('short_description');
    expect(data.challenge).toHaveProperty('cover_image_url');
    expect(data.challenge).toHaveProperty('challenge_type');
    expect(data.challenge).toHaveProperty('prize_amount');
    expect(data.challenge).toHaveProperty('teams_registered_count');
    expect(data.challenge).toHaveProperty('participant_signup_url');
  });

  test('should return 400 for invalid UUID format', async ({ request }) => {
    const response = await request.get('/api/challenges/not-a-uuid');

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Invalid challenge ID format');
  });

  test('should return 404 for non-existent challenge ID', async ({ request }) => {
    const response = await request.get('/api/challenges/00000000-0000-0000-0000-000000000000');

    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('should respond to OPTIONS preflight on detail endpoint', async ({ request }) => {
    const response = await request.fetch('/api/challenges/00000000-0000-0000-0000-000000000000', {
      method: 'OPTIONS',
      headers: {
        Origin: LEARNWORLDS_ORIGIN,
      },
    });

    expect(response.status()).toBe(204);
    expect(response.headers()).toHaveProperty('access-control-allow-methods');
    expect(response.headers()).toHaveProperty('access-control-allow-headers');
  });
});
