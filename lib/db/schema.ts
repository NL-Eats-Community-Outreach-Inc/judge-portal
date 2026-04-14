import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  jsonb,
  unique,
  check,
  index,
  pgEnum,
  boolean,
  AnyPgColumn,
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

export const learnerRecommendations = pgTable(
  'learner_recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    learnworldsUserId: text('learnworlds_user_id').notNull(),
    recommendedItemId: text('recommended_item_id').notNull(),
    recommendedItemType: text('recommended_item_type'),
    recommendedTitle: text('recommended_title').notNull(),
    rationale: text('rationale').notNull(),
    source: text('source').default('rule').notNull(),
    ruleMatched: text('rule_matched'),
    modelVersion: text('model_version'),
    score: numeric('score', { precision: 12, scale: 6 }),
    generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    learnworldsUserIdx: index('idx_learner_recommendations_learnworlds_user').on(
      table.learnworldsUserId
    ),
    generatedAtIdx: index('idx_learner_recommendations_generated_at').on(table.generatedAt),
    userGeneratedAtIdx: index('idx_learner_recommendations_user_generated_at').on(
      table.learnworldsUserId,
      table.generatedAt
    ),
    checkSource: check(
      'check_learner_recommendations_source',
      sql`${table.source} IN ('rule', 'ml', 'fallback')`
    ),
  })
);

export const learnerItemEvents = pgTable(
  'learner_item_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    learnworldsUserId: text('learnworlds_user_id').notNull(),
    itemId: text('item_id').notNull(),
    itemType: text('item_type').notNull(),
    eventType: text('event_type').notNull(),
    eventValue: numeric('event_value', { precision: 12, scale: 6 }),
    eventTimestamp: timestamp('event_timestamp', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    source: text('source').default('system').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    learnworldsUserIdx: index('idx_learner_item_events_learnworlds_user').on(
      table.learnworldsUserId
    ),
    itemIdx: index('idx_learner_item_events_item').on(table.itemId),
    eventTypeIdx: index('idx_learner_item_events_event_type').on(table.eventType),
    eventTimestampIdx: index('idx_learner_item_events_event_timestamp').on(table.eventTimestamp),
    userEventTimestampIdx: index('idx_learner_item_events_user_event_timestamp').on(
      table.learnworldsUserId,
      table.eventTimestamp
    ),
    checkItemType: check(
      'check_learner_item_events_item_type',
      sql`${table.itemType} IN ('course', 'module', 'lesson', 'challenge', 'recommendation')`
    ),
    checkEventType: check(
      'check_learner_item_events_event_type',
      sql`${table.eventType} IN ('viewed', 'started', 'progressed', 'completed', 'recommendation_clicked', 'recommendation_ignored', 'feedback_submitted')`
    ),
    checkSource: check(
      'check_learner_item_events_source',
      sql`${table.source} IN ('learnworlds', 'widget', 'api', 'system')`
    ),
  })
);

export const recommendationImpressions = pgTable(
  'recommendation_impressions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recommendationId: uuid('recommendation_id')
      .references(() => learnerRecommendations.id, { onDelete: 'cascade' })
      .notNull(),
    learnworldsUserId: text('learnworlds_user_id').notNull(),
    itemId: text('item_id').notNull(),
    itemType: text('item_type'),
    source: text('source').default('api').notNull(),
    modelVersion: text('model_version'),
    score: numeric('score', { precision: 12, scale: 6 }),
    rankPosition: integer('rank_position'),
    shownAt: timestamp('shown_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    recommendationIdx: index('idx_recommendation_impressions_recommendation').on(
      table.recommendationId
    ),
    learnworldsUserIdx: index('idx_recommendation_impressions_learnworlds_user').on(
      table.learnworldsUserId
    ),
    userShownAtIdx: index('idx_recommendation_impressions_user_shown_at').on(
      table.learnworldsUserId,
      table.shownAt
    ),
    checkItemType: check(
      'check_recommendation_impressions_item_type',
      sql`${table.itemType} IS NULL OR ${table.itemType} IN ('course', 'module', 'lesson', 'challenge', 'recommendation')`
    ),
    checkRankPosition: check(
      'check_recommendation_impressions_rank_position',
      sql`${table.rankPosition} IS NULL OR ${table.rankPosition} >= 1`
    ),
  })
);

export const recommendationOutcomes = pgTable(
  'recommendation_outcomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recommendationImpressionId: uuid('recommendation_impression_id')
      .references(() => recommendationImpressions.id, { onDelete: 'cascade' })
      .notNull(),
    learnworldsUserId: text('learnworlds_user_id').notNull(),
    itemId: text('item_id').notNull(),
    outcomeType: text('outcome_type').notNull(),
    labelValue: integer('label_value'),
    outcomeTimestamp: timestamp('outcome_timestamp', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    impressionIdx: index('idx_recommendation_outcomes_impression').on(
      table.recommendationImpressionId
    ),
    learnworldsUserIdx: index('idx_recommendation_outcomes_learnworlds_user').on(
      table.learnworldsUserId
    ),
    outcomeTypeIdx: index('idx_recommendation_outcomes_outcome_type').on(table.outcomeType),
    userOutcomeTimestampIdx: index('idx_recommendation_outcomes_user_outcome_timestamp').on(
      table.learnworldsUserId,
      table.outcomeTimestamp
    ),
    checkOutcomeType: check(
      'check_recommendation_outcomes_outcome_type',
      sql`${table.outcomeType} IN ('clicked', 'started', 'completed', 'dismissed', 'no_action')`
    ),
    checkLabelValue: check(
      'check_recommendation_outcomes_label_value',
      sql`${table.labelValue} IS NULL OR ${table.labelValue} IN (0, 1)`
    ),
  })
);

export const recommendationFeedback = pgTable(
  'recommendation_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recommendationId: uuid('recommendation_id').references(() => learnerRecommendations.id, {
      onDelete: 'cascade',
    }),
    learnworldsUserId: text('learnworlds_user_id').notNull(),
    recommendedItemId: text('recommended_item_id').notNull(),
    feedbackType: text('feedback_type'),
    rating: integer('rating'),
    comment: text('comment'),
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    recommendationIdx: index('idx_recommendation_feedback_recommendation').on(
      table.recommendationId
    ),
    learnworldsUserIdx: index('idx_recommendation_feedback_learnworlds_user').on(
      table.learnworldsUserId
    ),
    checkFeedbackType: check(
      'check_recommendation_feedback_feedback_type',
      sql`${table.feedbackType} IS NULL OR ${table.feedbackType} IN ('helpful', 'not_helpful')`
    ),
    checkRating: check(
      'check_recommendation_feedback_rating',
      sql`${table.rating} IS NULL OR (${table.rating} >= 1 AND ${table.rating} <= 5)`
    ),
  })
);

export const learningItems = pgTable(
  'learning_items',
  {
    itemId: text('item_id').primaryKey(),
    itemType: text('item_type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    category: text('category'),
    difficultyLevel: text('difficulty_level'),
    estimatedDurationMinutes: integer('estimated_duration_minutes'),
    prerequisiteItemId: text('prerequisite_item_id').references(
      (): AnyPgColumn => learningItems.itemId,
      {
        onDelete: 'set null',
      }
    ),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    itemTypeIdx: index('idx_learning_items_item_type').on(table.itemType),
    categoryIdx: index('idx_learning_items_category').on(table.category),
    isActiveIdx: index('idx_learning_items_is_active').on(table.isActive),
    checkItemType: check(
      'check_learning_items_item_type',
      sql`${table.itemType} IN ('course', 'module', 'lesson')`
    ),
    checkEstimatedDuration: check(
      'check_learning_items_estimated_duration',
      sql`${table.estimatedDurationMinutes} IS NULL OR ${table.estimatedDurationMinutes} >= 0`
    ),
  })
);

export const mlTrainingExamples = pgTable(
  'ml_training_examples',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    learnworldsUserId: text('learnworlds_user_id').notNull(),
    candidateItemId: text('candidate_item_id').notNull(),
    snapshotTime: timestamp('snapshot_time', { withTimezone: true, mode: 'string' }).notNull(),
    totalItemsStarted: integer('total_items_started'),
    totalItemsCompleted: integer('total_items_completed'),
    completionRate: numeric('completion_rate', { precision: 12, scale: 6 }),
    avgProgressPercentage: numeric('avg_progress_percentage', { precision: 12, scale: 6 }),
    daysSinceLastActivity: integer('days_since_last_activity'),
    activeCoursesCount: integer('active_courses_count'),
    completedCoursesCount: integer('completed_courses_count'),
    preferredCategory: text('preferred_category'),
    preferredDifficulty: text('preferred_difficulty'),
    itemType: text('item_type'),
    itemCategory: text('item_category'),
    itemDifficulty: text('item_difficulty'),
    itemDurationMinutes: integer('item_duration_minutes'),
    hasPrerequisite: boolean('has_prerequisite'),
    isPrerequisiteCompleted: boolean('is_prerequisite_completed'),
    candidatePopularity7d: integer('candidate_popularity_7d'),
    candidateCompletionRate30d: numeric('candidate_completion_rate_30d', {
      precision: 12,
      scale: 6,
    }),
    sameCategoryAsRecentActivity: boolean('same_category_as_recent_activity'),
    sameDifficultyAsRecentActivity: boolean('same_difficulty_as_recent_activity'),
    learnworldsUserHasSeenItemBefore: boolean('learnworlds_user_has_seen_item_before'),
    learnworldsUserStartedSimilarItemsBefore: boolean(
      'learnworlds_user_started_similar_items_before'
    ),
    learnworldsUserCompletedPrerequisite: boolean('learnworlds_user_completed_prerequisite'),
    candidateIsNextInPath: boolean('candidate_is_next_in_path'),
    candidatePreviouslyIgnored: boolean('candidate_previously_ignored'),
    labelEngaged: integer('label_engaged').notNull(),
    split: text('split').notNull(),
    modelingWindowStart: timestamp('modeling_window_start', { withTimezone: true, mode: 'string' }),
    modelingWindowEnd: timestamp('modeling_window_end', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    learnworldsUserIdx: index('idx_ml_training_examples_learnworlds_user').on(
      table.learnworldsUserId
    ),
    candidateItemIdx: index('idx_ml_training_examples_candidate_item').on(table.candidateItemId),
    splitIdx: index('idx_ml_training_examples_split').on(table.split),
    checkSplit: check(
      'check_ml_training_examples_split',
      sql`${table.split} IN ('train', 'validation', 'test')`
    ),
    checkLabelEngaged: check(
      'check_ml_training_examples_label_engaged',
      sql`${table.labelEngaged} IN (0, 1)`
    ),
    checkTotalItemsStarted: check(
      'check_ml_training_examples_total_items_started',
      sql`${table.totalItemsStarted} IS NULL OR ${table.totalItemsStarted} >= 0`
    ),
    checkTotalItemsCompleted: check(
      'check_ml_training_examples_total_items_completed',
      sql`${table.totalItemsCompleted} IS NULL OR ${table.totalItemsCompleted} >= 0`
    ),
    checkDaysSinceLastActivity: check(
      'check_ml_training_examples_days_since_last_activity',
      sql`${table.daysSinceLastActivity} IS NULL OR ${table.daysSinceLastActivity} >= 0`
    ),
    checkActiveCoursesCount: check(
      'check_ml_training_examples_active_courses_count',
      sql`${table.activeCoursesCount} IS NULL OR ${table.activeCoursesCount} >= 0`
    ),
    checkCompletedCoursesCount: check(
      'check_ml_training_examples_completed_courses_count',
      sql`${table.completedCoursesCount} IS NULL OR ${table.completedCoursesCount} >= 0`
    ),
    checkItemDurationMinutes: check(
      'check_ml_training_examples_item_duration_minutes',
      sql`${table.itemDurationMinutes} IS NULL OR ${table.itemDurationMinutes} >= 0`
    ),
    checkCandidatePopularity7d: check(
      'check_ml_training_examples_candidate_popularity_7d',
      sql`${table.candidatePopularity7d} IS NULL OR ${table.candidatePopularity7d} >= 0`
    ),
  })
);

export const modelRegistry = pgTable(
  'model_registry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    modelVersion: text('model_version').notNull().unique(),
    modelType: text('model_type').notNull(),
    featureSchemaVersion: text('feature_schema_version').notNull(),
    artifactPath: text('artifact_path').notNull(),
    trainingStart: timestamp('training_start', { withTimezone: true, mode: 'string' }),
    trainingEnd: timestamp('training_end', { withTimezone: true, mode: 'string' }),
    isActive: boolean('is_active').default(false).notNull(),
    metrics: jsonb('metrics'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => ({
    isActiveIdx: index('idx_model_registry_is_active').on(table.isActive),
    checkModelType: check(
      'check_model_registry_model_type',
      sql`${table.modelType} IN ('logistic_regression', 'xgboost', 'lightgbm')`
    ),
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
export type Competition = typeof competitions.$inferSelect;
export type NewCompetition = typeof competitions.$inferInsert;
export type LearnerRecommendation = typeof learnerRecommendations.$inferSelect;
export type NewLearnerRecommendation = typeof learnerRecommendations.$inferInsert;
export type LearnerItemEvent = typeof learnerItemEvents.$inferSelect;
export type NewLearnerItemEvent = typeof learnerItemEvents.$inferInsert;
export type RecommendationImpression = typeof recommendationImpressions.$inferSelect;
export type NewRecommendationImpression = typeof recommendationImpressions.$inferInsert;
export type RecommendationOutcome = typeof recommendationOutcomes.$inferSelect;
export type NewRecommendationOutcome = typeof recommendationOutcomes.$inferInsert;
export type RecommendationFeedback = typeof recommendationFeedback.$inferSelect;
export type NewRecommendationFeedback = typeof recommendationFeedback.$inferInsert;
export type LearningItem = typeof learningItems.$inferSelect;
export type NewLearningItem = typeof learningItems.$inferInsert;
export type MlTrainingExample = typeof mlTrainingExamples.$inferSelect;
export type NewMlTrainingExample = typeof mlTrainingExamples.$inferInsert;
export type ModelRegistry = typeof modelRegistry.$inferSelect;
export type NewModelRegistry = typeof modelRegistry.$inferInsert;
