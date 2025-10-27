import { v4 as uuidv4 } from 'uuid';

// Generates a brand‑new email for the test user.
export function uniqueTestEmail(): string {
  return `test-judge-${uuidv4()}@example.com`;
}