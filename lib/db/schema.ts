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
  boolean,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const eventStatusEnum = pgEnum('event_status', ['setup', 'open', 'active', 'completed']);
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'admin', 'judge', 'participant']);
export const criteriaCategoryEnum = pgEnum('criteria_category', ['technical', 'business']);
export const teamAwardTypeEnum = pgEnum('team_award_type', ['technical', 'business', 'both']);
export const invitationRoleEnum = pgEnum('invitation_role', ['admin', 'judge', 'participant']);
export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'revoked',
  'expired',
]);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    logoUrl: text('logo_url'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull()
      .$onUpdate(() => sql`timezone('utc'::text, now())`),
  },
  (table) => ({
    slugIdx: index('idx_organizations_slug').on(table.slug),
  })
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    status: eventStatusEnum('status').default('setup'),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    maxTeamSize: integer('max_team_size'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull()
      .$onUpdate(() => sql`timezone('utc'::text, now())`),
  },
  (table) => ({
    organizationIdx: index('idx_events_organization').on(table.organizationId),
  })
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    role: userRoleEnum('role').default('judge'),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull()
      .$onUpdate(() => sql`timezone('utc'::text, now())`),
  },
  (table) => ({
    organizationIdx: index('idx_users_organization').on(table.organizationId),
  })
);

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
    joinCode: text('join_code').unique(),
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
    joinCodeIdx: index('idx_teams_join_code').on(table.joinCode),
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
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
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
    organizationIdx: index('idx_invitations_organization').on(table.organizationId),
  })
);

export const eventParticipants = pgTable(
  'event_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
    participantId: uuid('participant_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    registeredAt: timestamp('registered_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    uniqueEventParticipant: unique().on(table.eventId, table.participantId),
    eventIdx: index('idx_event_participants_event').on(table.eventId),
    participantIdx: index('idx_event_participants_participant').on(table.participantId),
  })
);

export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .references(() => teams.id, { onDelete: 'cascade' })
      .notNull(),
    participantId: uuid('participant_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    isCreator: boolean('is_creator').default(false).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    uniqueTeamMember: unique().on(table.teamId, table.participantId),
    teamIdx: index('idx_team_members_team').on(table.teamId),
    participantIdx: index('idx_team_members_participant').on(table.participantId),
  })
);

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    uniqueOrgUser: unique().on(table.organizationId, table.userId),
    orgIdx: index('idx_org_members_organization').on(table.organizationId),
    userIdx: index('idx_org_members_user').on(table.userId),
  })
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
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
export type EventParticipant = typeof eventParticipants.$inferSelect;
export type NewEventParticipant = typeof eventParticipants.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;