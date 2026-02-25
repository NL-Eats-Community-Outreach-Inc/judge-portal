import { randomUUID } from 'crypto';

type Role = 'judge' | 'participant';

// Generates a brand‑new email for the test user.
export function uniqueTestEmail(role: Role): string {
  return `test-${role}-${randomUUID()}@example.com`;
}
