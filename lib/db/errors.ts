/**
 * Helpers for recognising PostgreSQL errors thrown through Drizzle.
 *
 * Drizzle wraps driver errors in `DrizzleQueryError` and puts the original
 * `PostgresError` in `error.cause`, so the walk below checks both. Constraint
 * names differ between environments (`teams_event_id_name_key` from the SQL
 * files, `teams_event_id_name_unique` from `drizzle-kit push`), so callers
 * match on the columns a constraint covers, never on its exact name.
 */

const UNIQUE_VIOLATION = '23505';

export interface UniqueViolation {
  constraint: string;
}

function readField(error: unknown, field: string): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Returns the violated constraint when `error` (or anything in its `cause`
 * chain) is a PostgreSQL unique violation, otherwise `null`.
 */
export function getUniqueViolation(error: unknown): UniqueViolation | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (readField(current, 'code') === UNIQUE_VIOLATION) {
      const constraint =
        readField(current, 'constraint_name') ?? readField(current, 'constraint') ?? '';
      return { constraint };
    }
    current = typeof current === 'object' ? (current as { cause?: unknown }).cause : undefined;
  }
  return null;
}

/**
 * True when `error` is a unique violation on a constraint whose name contains
 * every given column name (in any order), e.g. `isUniqueOn(error, 'event_id', 'name')`.
 */
export function isUniqueOn(error: unknown, ...columns: string[]): boolean {
  const violation = getUniqueViolation(error);
  if (!violation) return false;
  return columns.every((column) => violation.constraint.includes(column));
}
