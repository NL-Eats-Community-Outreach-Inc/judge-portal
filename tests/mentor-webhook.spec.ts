import { test, expect } from '@playwright/test';
import { createHmac } from 'crypto';

const WEBHOOK_SECRET = process.env.LEARNWORLDS_WEBHOOK_SECRET;

const WEBHOOK_URL = '/api/webhooks/learnworlds/mentor';

function signPayload(payload: object): string {
  return createHmac('sha256', WEBHOOK_SECRET!).update(JSON.stringify(payload)).digest('hex');
}

const validPayload = {
  user_id: 'lw-user-001',
  name: 'Jane Doe',
  email: 'jane@example.com',
  cf_mentor_title: 'Real Estate Attorney',
  cf_mentor_org: 'Doe Law Group',
  cf_mentor_bio: '10 years of experience in residential real estate.',
  cf_mentor_linkedin: 'https://linkedin.com/in/janedoe',
  cf_mentor_calendly: 'https://calendly.com/janedoe',
  tags: ['role_mentor'],
};

test.describe('Mentor webhook endpoint', () => {
  test('reaches webhook handler without a Supabase session', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      data: validPayload,
      maxRedirects: 0,
    });

    expect(response.status()).not.toBe(302);
    expect([401, 500]).toContain(response.status());
  });
});

test.describe('Mentor webhook endpoint with configured secret', () => {
  test.skip(!WEBHOOK_SECRET, 'LEARNWORLDS_WEBHOOK_SECRET not set');

  test('rejects requests without signature', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      data: validPayload,
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Invalid signature');
  });

  test('rejects requests with wrong signature', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      headers: { 'x-lw-signature': 'wrong-signature' },
      data: validPayload,
    });

    expect(response.status()).toBe(401);
  });

  test('ignores webhook missing the role_mentor tag', async ({ request }) => {
    const payloadWithoutTag = { ...validPayload, tags: ['student_tag'] };
    const response = await request.post(WEBHOOK_URL, {
      headers: { 'x-lw-signature': signPayload(payloadWithoutTag) },
      data: payloadWithoutTag,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.message).toBe('Ignored: No mentor tag');
  });

  test('rejects payload missing user_id', async ({ request }) => {
    const payload = { name: 'No ID Mentor', cf_mentor_title: 'Consultant',tags: ['role_mentor'] };
    const response = await request.post(WEBHOOK_URL, {
      headers: { 'x-lw-signature': signPayload(payload) },
      data: payload,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Missing user_id');
  });

  test('accepts valid mentor webhook payload', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      headers: { 'x-lw-signature': signPayload(validPayload) },
      data: validPayload,
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('handles duplicate webhook (upsert)', async ({ request }) => {
    const first = await request.post(WEBHOOK_URL, {
      headers: { 'x-lw-signature': signPayload(validPayload) },
      data: validPayload,
    });
    expect(first.ok()).toBeTruthy();

    const updatedPayload = { ...validPayload, cf_mentor_title: 'Updated Title' };
    const second = await request.post(WEBHOOK_URL, {
      headers: { 'x-lw-signature': signPayload(updatedPayload) },
      data: updatedPayload,
    });
    expect(second.ok()).toBeTruthy();
  });
});
