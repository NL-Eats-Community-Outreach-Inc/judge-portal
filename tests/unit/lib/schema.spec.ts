import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { events, users, criteria, teams } from '@/lib/db/schema';

/**
 * `lib/db/schema.ts` must describe what both databases already are, so the next
 * `drizzle-kit push` or `generate` neither drops a NOT NULL nor an index.
 */
describe('lib/db/schema', () => {
  it('events.status and users.role are NOT NULL', () => {
    expect(getTableColumns(events).status.notNull).toBe(true);
    expect(getTableColumns(users).role.notNull).toBe(true);
  });

  it('declares the category and award-type indexes the setup SQL creates', () => {
    const criteriaIndexes = getTableConfig(criteria).indexes.map((i) => i.config.name);
    const teamIndexes = getTableConfig(teams).indexes.map((i) => i.config.name);
    expect(criteriaIndexes).toContain('idx_criteria_category');
    expect(teamIndexes).toContain('idx_teams_award_type');
  });
});
