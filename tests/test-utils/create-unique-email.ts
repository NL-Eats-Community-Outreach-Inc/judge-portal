import { randomUUID } from 'crypto';

// Generates a brand‑new email for the test user.
export function uniqueTestEmail(): string {
  return `test-judge-${randomUUID()}@example.com`;
}
