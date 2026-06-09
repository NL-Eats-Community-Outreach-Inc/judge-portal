import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

// Admin happy-path coverage requires a signed-in admin session fixture
// (not yet set up in this suite). These tests cover the auth gate and
// input-validation ordering only.

const ADMIN_MENTORS_URL = '/api/admin/mentors';

test.describe('GET /api/admin/mentors -- auth gate', () => {
  test('returns 401 when unauthenticated', async ({ request }) => {
    const response = await request.get(ADMIN_MENTORS_URL);
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('auth check runs before query validation', async ({ request }) => {
    const response = await request.get(`${ADMIN_MENTORS_URL}?visibility=bogus`);
    // Bogus filter would be 400 for an authed user, but auth fires first.
    expect(response.status()).toBe(401);
  });
});

test.describe('PATCH /api/admin/mentors/[id] -- auth gate', () => {
  const SAMPLE_UUID = randomUUID();

  test('returns 401 when unauthenticated', async ({ request }) => {
    const response = await request.patch(`${ADMIN_MENTORS_URL}/${SAMPLE_UUID}`, {
      data: { isVisible: true },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  // Auth gate fires before any input parsing. Each of these would be a 400
  // for an authed admin; unauthenticated, they all funnel to 401.
  const invalidInputs: Array<{ name: string; path: string; body: unknown; contentType?: string }> =
    [
      { name: 'invalid UUID path', path: 'not-a-uuid', body: { isVisible: true } },
      {
        name: 'malformed JSON body',
        path: SAMPLE_UUID,
        body: '{not-json',
        contentType: 'application/json',
      },
      { name: 'missing isVisible field', path: SAMPLE_UUID, body: {} },
      { name: 'non-boolean isVisible', path: SAMPLE_UUID, body: { isVisible: 'yes' } },
    ];

  for (const { name, path, body, contentType } of invalidInputs) {
    test(`returns 401 with ${name} (auth checked before validation)`, async ({ request }) => {
      const response = await request.patch(`${ADMIN_MENTORS_URL}/${path}`, {
        ...(contentType ? { headers: { 'content-type': contentType } } : {}),
        data: body as object,
      });
      expect(response.status()).toBe(401);
    });
  }
});
