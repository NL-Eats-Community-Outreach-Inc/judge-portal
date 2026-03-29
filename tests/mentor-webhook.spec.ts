import { test, expect } from '@playwright/test';

const WEBHOOK_URL = '/api/webhooks/learnworlds/mentor';
const WEBHOOK_SECRET = process.env.LEARNWORLDS_WEBHOOK_SECRET || 'test-webhook-secret';

const validPayload = {
  user_id: 'lw-user-001',
  name: 'Jane Doe',
  email: 'jane@example.com',
  cf_mentor_title: 'Real Estate Attorney',
  cf_mentor_org: 'Doe Law Group',
  cf_mentor_bio: '10 years of experience in residential real estate.',
  cf_mentor_linkedin: 'https://linkedin.com/in/janedoe',
  cf_mentor_calendly: 'https://calendly.com/janedoe',
};

test.describe('Mentor webhook endpoint', () => {
  test('rejects requests without webhook secret', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      data: validPayload,
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Invalid signature');
  });

  test('rejects requests with wrong webhook secret', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      headers: { 'x-webhook-secret': 'wrong-secret' },
      data: validPayload,
    });

    expect(response.status()).toBe(401);
  });

  test('rejects payload missing user_id', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      headers: { 'x-webhook-secret': WEBHOOK_SECRET },
      data: { name: 'No ID Mentor', cf_mentor_title: 'Consultant' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Missing user_id');
  });

  test('accepts valid mentor webhook payload', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      headers: { 'x-webhook-secret': WEBHOOK_SECRET },
      data: validPayload,
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('handles duplicate webhook (upsert)', async ({ request }) => {
    // Send same payload twice — should not error
    const first = await request.post(WEBHOOK_URL, {
      headers: { 'x-webhook-secret': WEBHOOK_SECRET },
      data: validPayload,
    });
    expect(first.ok()).toBeTruthy();

    const second = await request.post(WEBHOOK_URL, {
      headers: { 'x-webhook-secret': WEBHOOK_SECRET },
      data: { ...validPayload, cf_mentor_title: 'Updated Title' },
    });
    expect(second.ok()).toBeTruthy();
  });
});
