import { db } from '@/lib/db';
import { teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const JOIN_CODE_LENGTH = 6;
// Exclude ambiguous characters: I, O, 0, 1
const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  }
  return code;
}

/**
 * Generate a unique 6-character join code. Retries on collision.
 */
export async function generateJoinCode(maxRetries = 5): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = randomCode();
    const existing = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.joinCode, code))
      .limit(1);
    if (existing.length === 0) {
      return code;
    }
  }
  throw new Error('Failed to generate unique join code after maximum retries');
}

/**
 * Validate that a string is a valid join code format (6 uppercase alphanumeric chars).
 */
export function isValidJoinCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}
