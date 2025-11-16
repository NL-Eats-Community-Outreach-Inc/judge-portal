import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  unique,
  check,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const eventStatusEnum = pgEnum('event_status', ['setup', 'active', 'completed']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'judge', 'participant']);
export const criteriaCategoryEnum = pgEnum('criteria_category', ['technical', 'business']);
export const teamAwardTypeEnum = pgEnum('team_award_type', ['technical', 'business', 'both']);
export const invitationRoleEnum = pgEnum('invitation_role', ['judge', 'participant']);
export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'revoked',
  'expired',
]);

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  status: eventStatusEnum('status').default('setup'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull()
    .$onUpdate(() => sql`timezone('utc'::text, now())`),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  role: userRoleEnum('role').default('judge'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull()
    .$onUpdate(() => sql`timezone('utc'::text, now())`),
});

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    demoUrl: text('demo_url'),
    repoUrl: text('repo_url'),
    presentationOrder: integer('presentation_order').notNull(),
    awardType: teamAwardTypeEnum('award_type').default('both').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull()
      .$onUpdate(() => sql`timezone('utc'::text, now())`),
  },
  (table) => ({
    uniqueEventOrder: unique().on(table.eventId, table.presentationOrder),
    uniqueEventName: unique().on(table.eventId, table.name),
    eventOrderIdx: index('idx_teams_event_order').on(table.eventId, table.presentationOrder),
  })
);

export const criteria = pgTable(
  'criteria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    minScore: integer('min_score').default(1).notNull(),
    maxScore: integer('max_score').default(10).notNull(),
    displayOrder: integer('display_order').notNull(),
    weight: integer('weight').default(20).notNull(),
    category: criteriaCategoryEnum('category').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull()
      .$onUpdate(() => sql`timezone('utc'::text, now())`),
  },
  (table) => ({
    uniqueEventOrder: unique().on(table.eventId, table.displayOrder),
    uniqueEventName: unique().on(table.eventId, table.name),
    checkScoreRange: check('check_score_range', sql`${table.minScore} < ${table.maxScore}`),
    checkWeightRange: check(
      'check_weight_range',
      sql`${table.weight} >= 0 AND ${table.weight} <= 100`
    ),
    eventOrderIdx: index('idx_criteria_event_order').on(table.eventId, table.displayOrder),
  })
);

export const eventJudges = pgTable(
  'event_judges',
  {
    eventId: uuid('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
    judgeId: uuid('judge_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    pk: unique().on(table.eventId, table.judgeId),
    eventIdx: index('idx_event_judges_event').on(table.eventId),
    judgeIdx: index('idx_event_judges_judge').on(table.judgeId),
  })
);

export const scores = pgTable(
  'scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
    judgeId: uuid('judge_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    teamId: uuid('team_id')
      .references(() => teams.id, { onDelete: 'cascade' })
      .notNull(),
    criterionId: uuid('criterion_id')
      .references(() => criteria.id, { onDelete: 'cascade' })
      .notNull(),
    score: integer('score').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull()
      .$onUpdate(() => sql`timezone('utc'::text, now())`),
  },
  (table) => ({
    uniqueJudgeTeamCriterion: unique().on(table.judgeId, table.teamId, table.criterionId),
    eventJudgeTeamIdx: index('idx_scores_event_judge_team').on(
      table.eventId,
      table.judgeId,
      table.teamId
    ),
    eventTeamCriterionIdx: index('idx_scores_event_team_criterion').on(
      table.eventId,
      table.teamId,
      table.criterionId
    ),
    judgeEventIdx: index('idx_scores_judge_event').on(table.judgeId, table.eventId),
  })
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull().unique(),
    email: text('email').notNull(),
    role: invitationRoleEnum('role').notNull(),
    status: invitationStatusEnum('status').default('pending').notNull(),
    customMessage: text('custom_message'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'string' }),
    createdBy: uuid('created_by')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull()
      .$onUpdate(() => sql`timezone('utc'::text, now())`),
  },
  (table) => ({
    tokenIdx: index('idx_invitations_token').on(table.token),
    emailIdx: index('idx_invitations_email').on(table.email),
    statusIdx: index('idx_invitations_status').on(table.status),
    createdByIdx: index('idx_invitations_created_by').on(table.createdBy),
  })
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Criterion = typeof criteria.$inferSelect;
export type NewCriterion = typeof criteria.$inferInsert;
export type EventJudge = typeof eventJudges.$inferSelect;
export type NewEventJudge = typeof eventJudges.$inferInsert;
export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
