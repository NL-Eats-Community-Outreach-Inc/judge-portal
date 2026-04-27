import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  unique,
  uniqueIndex,
  check,
  index,
  pgEnum,
  boolean,
  jsonb,
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

export const competitions = pgTable(
  'competitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    title: text('title'),
    shortDescription: text('short_description'),
    coverImageUrl: text('cover_image_url'),
    challengeType: text('challenge_type').default('global').notNull(),
    tags: text('tags').array(),
    prize: text('prize'),
    deadline: timestamp('deadline', { withTimezone: true, mode: 'string' }),
    country: text('country'),
    participantSignupUrl: text('participant_signup_url'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull()
      .$onUpdate(() => sql`timezone('utc'::text, now())`),
  },
  (table) => ({
    eventIdx: index('idx_competitions_event').on(table.eventId),
  })
);

export const learnworldsSyncRuns = pgTable(
  'learnworlds_sync_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    triggerMode: text('trigger_mode').default('manual').notNull(),
    status: text('status').default('running').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
    totalRecords: integer('total_records').default(0).notNull(),
    validRecords: integer('valid_records').default(0).notNull(),
    invalidRecords: integer('invalid_records').default(0).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull()
      .$onUpdate(() => sql`timezone('utc'::text, now())`),
  },
  (table) => ({
    statusIdx: index('idx_lw_sync_runs_status').on(table.status),
    startedAtIdx: index('idx_lw_sync_runs_started_at').on(table.startedAt),
    checkTriggerMode: check(
      'check_lw_sync_runs_trigger_mode',
      sql`${table.triggerMode} IN ('manual', 'scheduled', 'webhook')`
    ),
    checkStatus: check(
      'check_lw_sync_runs_status',
      sql`${table.status} IN ('running', 'succeeded', 'failed', 'partial')`
    ),
    checkRecordCounts: check(
      'check_lw_sync_runs_record_counts',
      sql`${table.totalRecords} >= 0 AND ${table.validRecords} >= 0 AND ${table.invalidRecords} >= 0`
    ),
  })
);

export const learnworldsRawPayloads = pgTable(
  'learnworlds_raw_payloads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    syncRunId: uuid('sync_run_id').references(() => learnworldsSyncRuns.id, {
      onDelete: 'set null',
    }),
    sourceEndpoint: text('source_endpoint').notNull(),
    httpStatus: integer('http_status').notNull(),
    learnerExternalId: text('learner_external_id'),
    courseExternalId: text('course_external_id'),
    moduleExternalId: text('module_external_id'),
    lessonExternalId: text('lesson_external_id'),
    completionStatus: text('completion_status'),
    progressPercentage: integer('progress_percentage'),
    lastActivityTimestamp: timestamp('last_activity_timestamp', {
      withTimezone: true,
      mode: 'string',
    }),
    recordHash: text('record_hash').notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    syncRunIdx: index('idx_lw_raw_payloads_sync_run').on(table.syncRunId),
    learnerIdx: index('idx_lw_raw_payloads_learner').on(table.learnerExternalId),
    courseIdx: index('idx_lw_raw_payloads_course').on(table.courseExternalId),
    receivedAtIdx: index('idx_lw_raw_payloads_received_at').on(table.receivedAt),
    uniqueSyncRecordHash: unique().on(table.syncRunId, table.recordHash),
    checkHttpStatus: check(
      'check_lw_raw_payloads_http_status',
      sql`${table.httpStatus} >= 100 AND ${table.httpStatus} <= 599`
    ),
    checkProgressPercentage: check(
      'check_lw_raw_payloads_progress_percentage',
      sql`${table.progressPercentage} IS NULL OR (${table.progressPercentage} >= 0 AND ${table.progressPercentage} <= 100)`
    ),
  })
);

export const learnerProgress = pgTable(
  'learner_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    learnworldsUserId: text('learnworlds_user_id').notNull(),
    courseId: text('course_id').notNull(),
    progressPercentage: integer('progress_percentage').default(0).notNull(),
    completedModules: integer('completed_modules').default(0).notNull(),
    completionStatus: text('completion_status').default('in_progress').notNull(),
    lastActivityTimestamp: timestamp('last_activity_timestamp', {
      withTimezone: true,
      mode: 'string',
    }),
    sourceSyncedAt: timestamp('source_synced_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    rawPayloadId: uuid('raw_payload_id').references(() => learnworldsRawPayloads.id, {
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
    uniqueLearnworldsUserCourse: unique().on(table.learnworldsUserId, table.courseId),
    learnworldsUserIdx: index('idx_learner_progress_learnworlds_user').on(table.learnworldsUserId),
    courseIdx: index('idx_learner_progress_course').on(table.courseId),
    lastActivityIdx: index('idx_learner_progress_last_activity').on(table.lastActivityTimestamp),
    sourceSyncedIdx: index('idx_learner_progress_source_synced').on(table.sourceSyncedAt),
    checkProgressPercentage: check(
      'check_learner_progress_percentage',
      sql`${table.progressPercentage} >= 0 AND ${table.progressPercentage} <= 100`
    ),
    checkCompletedModules: check(
      'check_learner_progress_completed_modules',
      sql`${table.completedModules} >= 0`
    ),
    checkCompletionStatus: check(
      'check_learner_progress_completion_status',
      sql`${table.completionStatus} IN ('in_progress', 'completed', 'failed', 'not_started')`
    ),
  })
);
export const mentorProfiles = pgTable('mentor_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  learnworldsUserId: text('learnworlds_user_id').unique().notNull(),
  fullName: text('full_name').notNull(),
  title: text('title'),
  organization: text('organization'),
  bio: text('bio'),
  linkedinUrl: text('linkedin_url'),
  calendlyUrl: text('calendly_url'),
  photoUrl: text('photo_url'),
  tags: text('tags').array(),
  isVisible: boolean('is_visible').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .default(sql`timezone('utc'::text, now())`)
    .notNull()
    .$onUpdate(() => sql`timezone('utc'::text, now())`),
});

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),

    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),

    submissionText: text('submission_text').notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    uniqueEventTeam: uniqueIndex('submissions_event_team_unique').on(table.eventId, table.teamId),
  })
);

export const submissionAiScores = pgTable('submission_ai_scores', {
  id: uuid('id').defaultRandom().primaryKey(),

  submissionId: uuid('submission_id')
    .notNull()
    .references(() => submissions.id, { onDelete: 'cascade' }),

  score: numeric('score').notNull(),

  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
});

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
export type Competition = typeof competitions.$inferSelect;
export type NewCompetition = typeof competitions.$inferInsert;
export type LearnworldsSyncRun = typeof learnworldsSyncRuns.$inferSelect;
export type NewLearnworldsSyncRun = typeof learnworldsSyncRuns.$inferInsert;
export type LearnworldsRawPayload = typeof learnworldsRawPayloads.$inferSelect;
export type NewLearnworldsRawPayload = typeof learnworldsRawPayloads.$inferInsert;
export type LearnerProgress = typeof learnerProgress.$inferSelect;
export type NewLearnerProgress = typeof learnerProgress.$inferInsert;
export type MentorProfile = typeof mentorProfiles.$inferSelect;
export type NewMentorProfile = typeof mentorProfiles.$inferInsert;
