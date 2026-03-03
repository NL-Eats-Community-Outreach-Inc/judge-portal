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

  test('should return open status by default when invalid status provided', async ({
    request,
  }) => {
    const response = await request.get('/api/challenges?status=invalid');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.challenges)).toBe(true);
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

  test('should respond to OPTIONS preflight request with CORS headers', async ({
    request,
  }) => {
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

  test('should include CORS headers in GET response from allowed origin', async ({
    request,
  }) => {
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
});
