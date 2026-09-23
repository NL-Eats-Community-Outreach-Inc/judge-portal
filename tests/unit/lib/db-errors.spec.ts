import { describe, it, expect } from 'vitest';
import { getUniqueViolation, isUniqueOn } from '@/lib/db/errors';

function postgresError(constraint: string, code = '23505') {
  const error = new Error(`duplicate key value violates unique constraint "${constraint}"`);
  return Object.assign(error, { code, constraint_name: constraint });
}

function drizzleWrapped(cause: unknown) {
  const error = new Error('Failed query: insert into "teams" ...');
  return Object.assign(error, { cause });
}

describe('getUniqueViolation', () => {
  it('returns the constraint for a bare PostgresError', () => {
    expect(getUniqueViolation(postgresError('teams_event_id_name_key'))).toEqual({
      constraint: 'teams_event_id_name_key',
    });
  });

  it('walks error.cause to find the PostgresError Drizzle wraps', () => {
    const error = drizzleWrapped(postgresError('teams_event_id_name_unique'));
    expect(getUniqueViolation(error)).toEqual({ constraint: 'teams_event_id_name_unique' });
  });

  it('accepts a `constraint` field when `constraint_name` is absent', () => {
    const error = Object.assign(new Error('dup'), { code: '23505', constraint: 'users_pkey' });
    expect(getUniqueViolation(error)).toEqual({ constraint: 'users_pkey' });
  });

  it('returns null for other SQLSTATE codes', () => {
    expect(getUniqueViolation(postgresError('check_score_range', '23514'))).toBeNull();
  });

  it('returns null for non-database errors and non-errors', () => {
    expect(getUniqueViolation(new Error('ALREADY_ON_TEAM'))).toBeNull();
    expect(getUniqueViolation(null)).toBeNull();
    expect(getUniqueViolation(undefined)).toBeNull();
    expect(getUniqueViolation('duplicate key')).toBeNull();
  });
});

describe('isUniqueOn', () => {
  it('matches the SQL-file naming style', () => {
    const error = postgresError('teams_event_id_name_key');
    expect(isUniqueOn(error, 'event_id', 'name')).toBe(true);
    expect(isUniqueOn(error, 'event_id', 'presentation_order')).toBe(false);
  });

  it('matches the drizzle-kit naming style', () => {
    const error = drizzleWrapped(postgresError('criteria_event_id_display_order_unique'));
    expect(isUniqueOn(error, 'event_id', 'display_order')).toBe(true);
    expect(isUniqueOn(error, 'event_id', 'name')).toBe(false);
  });

  it('requires every column to appear in the constraint name', () => {
    const error = postgresError('teams_event_id_presentation_order_unique');
    expect(isUniqueOn(error, 'presentation_order')).toBe(true);
    expect(isUniqueOn(error, 'event_id', 'presentation_order', 'name')).toBe(false);
  });

  it('is false for anything that is not a unique violation', () => {
    expect(isUniqueOn(new Error('boom'), 'event_id')).toBe(false);
    expect(isUniqueOn(postgresError('teams_event_id_name_key', '23503'), 'event_id')).toBe(false);
  });
});
