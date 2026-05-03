-- ================================================================
-- FEATURE: Personalized learning recommendation foundation
-- Description: Adds recommendation tracking, feedback, item catalog,
--              ML training examples, and model registry tables
-- Dependencies: consolidated_setup.sql, 001_invite-link.sql,
--               002_multi-tenant-participants.sql,
--               003_competitions.sql,
--               005_learnworlds-ingestion-foundation.sql
-- ================================================================

-- ================================================================
-- SECTION 1: RECOMMENDATION CORE TABLES
-- ================================================================

CREATE TABLE IF NOT EXISTS learner_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  learnworlds_user_id TEXT NOT NULL,
  recommended_item_id TEXT NOT NULL,
  recommended_item_type TEXT,
  recommended_title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  source TEXT DEFAULT 'rule' NOT NULL,
  rule_matched TEXT,
  model_version TEXT,
  score NUMERIC(12, 6),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_learner_recommendations_source
    CHECK (source IN ('rule', 'ml', 'fallback'))
);

CREATE TABLE IF NOT EXISTS learner_item_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  learnworlds_user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_value NUMERIC(12, 6),
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  source TEXT DEFAULT 'system' NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_learner_item_events_item_type
    CHECK (item_type IN ('course', 'module', 'lesson', 'challenge', 'recommendation')),
  CONSTRAINT check_learner_item_events_event_type
    CHECK (
      event_type IN (
        'viewed',
        'started',
        'progressed',
        'completed',
        'recommendation_clicked',
        'recommendation_ignored',
        'feedback_submitted'
      )
    ),
  CONSTRAINT check_learner_item_events_source
    CHECK (source IN ('learnworlds', 'widget', 'api', 'system'))
);

CREATE TABLE IF NOT EXISTS recommendation_impressions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id UUID REFERENCES learner_recommendations(id) ON DELETE SET NULL,
  learnworlds_user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_type TEXT,
  source TEXT DEFAULT 'api' NOT NULL,
  model_version TEXT,
  score NUMERIC(12, 6),
  rank_position INTEGER,
  shown_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_recommendation_impressions_item_type
    CHECK (
      item_type IS NULL OR
      item_type IN ('course', 'module', 'lesson', 'challenge', 'recommendation')
    ),
  CONSTRAINT check_recommendation_impressions_rank_position
    CHECK (rank_position IS NULL OR rank_position >= 1)
);

CREATE TABLE IF NOT EXISTS recommendation_outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_impression_id UUID
    REFERENCES recommendation_impressions(id) ON DELETE SET NULL,
  learnworlds_user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  outcome_type TEXT NOT NULL,
  label_value INTEGER,
  outcome_timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_recommendation_outcomes_outcome_type
    CHECK (outcome_type IN ('clicked', 'started', 'completed', 'dismissed', 'no_action')),
  CONSTRAINT check_recommendation_outcomes_label_value
    CHECK (label_value IS NULL OR label_value IN (0, 1))
);

CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id UUID REFERENCES learner_recommendations(id) ON DELETE SET NULL,
  learnworlds_user_id TEXT NOT NULL,
  recommended_item_id TEXT NOT NULL,
  feedback_type TEXT,
  rating INTEGER,
  comment TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_recommendation_feedback_feedback_type
    CHECK (feedback_type IS NULL OR feedback_type IN ('helpful', 'not_helpful')),
  CONSTRAINT check_recommendation_feedback_rating
    CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

-- ================================================================
-- SECTION 2: ITEM CATALOG + ML DATA TABLES
-- ================================================================

CREATE TABLE IF NOT EXISTS learning_items (
  item_id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  difficulty_level TEXT,
  estimated_duration_minutes INTEGER,
  prerequisite_item_id TEXT REFERENCES learning_items(item_id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_learning_items_item_type
    CHECK (item_type IN ('course', 'module', 'lesson')),
  CONSTRAINT check_learning_items_estimated_duration
    CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes >= 0)
);

CREATE TABLE IF NOT EXISTS ml_training_examples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  learnworlds_user_id TEXT NOT NULL,
  candidate_item_id TEXT NOT NULL,
  snapshot_time TIMESTAMP WITH TIME ZONE NOT NULL,
  total_items_started INTEGER,
  total_items_completed INTEGER,
  completion_rate NUMERIC(12, 6),
  avg_progress_percentage NUMERIC(12, 6),
  days_since_last_activity INTEGER,
  active_courses_count INTEGER,
  completed_courses_count INTEGER,
  preferred_category TEXT,
  preferred_difficulty TEXT,
  item_type TEXT,
  item_category TEXT,
  item_difficulty TEXT,
  item_duration_minutes INTEGER,
  has_prerequisite BOOLEAN,
  is_prerequisite_completed BOOLEAN,
  candidate_popularity_7d INTEGER,
  candidate_completion_rate_30d NUMERIC(12, 6),
  same_category_as_recent_activity BOOLEAN,
  same_difficulty_as_recent_activity BOOLEAN,
  learnworlds_user_has_seen_item_before BOOLEAN,
  learnworlds_user_started_similar_items_before BOOLEAN,
  learnworlds_user_completed_prerequisite BOOLEAN,
  candidate_is_next_in_path BOOLEAN,
  candidate_previously_ignored BOOLEAN,
  label_engaged INTEGER NOT NULL,
  split TEXT NOT NULL,
  modeling_window_start TIMESTAMP WITH TIME ZONE,
  modeling_window_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_ml_training_examples_split
    CHECK (split IN ('train', 'validation', 'test')),
  CONSTRAINT check_ml_training_examples_label_engaged
    CHECK (label_engaged IN (0, 1)),
  CONSTRAINT check_ml_training_examples_total_items_started
    CHECK (total_items_started IS NULL OR total_items_started >= 0),
  CONSTRAINT check_ml_training_examples_total_items_completed
    CHECK (total_items_completed IS NULL OR total_items_completed >= 0),
  CONSTRAINT check_ml_training_examples_days_since_last_activity
    CHECK (days_since_last_activity IS NULL OR days_since_last_activity >= 0),
  CONSTRAINT check_ml_training_examples_active_courses_count
    CHECK (active_courses_count IS NULL OR active_courses_count >= 0),
  CONSTRAINT check_ml_training_examples_completed_courses_count
    CHECK (completed_courses_count IS NULL OR completed_courses_count >= 0),
  CONSTRAINT check_ml_training_examples_item_duration_minutes
    CHECK (item_duration_minutes IS NULL OR item_duration_minutes >= 0),
  CONSTRAINT check_ml_training_examples_candidate_popularity_7d
    CHECK (candidate_popularity_7d IS NULL OR candidate_popularity_7d >= 0)
);

CREATE TABLE IF NOT EXISTS model_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_version TEXT NOT NULL UNIQUE,
  model_type TEXT NOT NULL,
  feature_schema_version TEXT NOT NULL,
  artifact_path TEXT NOT NULL,
  training_start TIMESTAMP WITH TIME ZONE,
  training_end TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT FALSE NOT NULL,
  metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_model_registry_model_type
    CHECK (model_type IN ('logistic_regression', 'xgboost', 'lightgbm'))
);

-- ================================================================
-- SECTION 3: INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_learner_recommendations_learnworlds_user
  ON learner_recommendations(learnworlds_user_id);

CREATE INDEX IF NOT EXISTS idx_learner_recommendations_generated_at
  ON learner_recommendations(generated_at);

CREATE INDEX IF NOT EXISTS idx_learner_recommendations_user_generated_at
  ON learner_recommendations(learnworlds_user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_learner_item_events_learnworlds_user
  ON learner_item_events(learnworlds_user_id);

CREATE INDEX IF NOT EXISTS idx_learner_item_events_item
  ON learner_item_events(item_id);

CREATE INDEX IF NOT EXISTS idx_learner_item_events_event_type
  ON learner_item_events(event_type);

CREATE INDEX IF NOT EXISTS idx_learner_item_events_event_timestamp
  ON learner_item_events(event_timestamp);

CREATE INDEX IF NOT EXISTS idx_learner_item_events_user_event_timestamp
  ON learner_item_events(learnworlds_user_id, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_recommendation
  ON recommendation_impressions(recommendation_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_learnworlds_user
  ON recommendation_impressions(learnworlds_user_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_user_shown_at
  ON recommendation_impressions(learnworlds_user_id, shown_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_outcomes_impression
  ON recommendation_outcomes(recommendation_impression_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_outcomes_learnworlds_user
  ON recommendation_outcomes(learnworlds_user_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_outcomes_outcome_type
  ON recommendation_outcomes(outcome_type);

CREATE INDEX IF NOT EXISTS idx_recommendation_outcomes_user_outcome_timestamp
  ON recommendation_outcomes(learnworlds_user_id, outcome_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_recommendation
  ON recommendation_feedback(recommendation_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_learnworlds_user
  ON recommendation_feedback(learnworlds_user_id);

CREATE INDEX IF NOT EXISTS idx_learning_items_item_type
  ON learning_items(item_type);

CREATE INDEX IF NOT EXISTS idx_learning_items_category
  ON learning_items(category);

CREATE INDEX IF NOT EXISTS idx_learning_items_is_active
  ON learning_items(is_active);

CREATE INDEX IF NOT EXISTS idx_ml_training_examples_learnworlds_user
  ON ml_training_examples(learnworlds_user_id);

CREATE INDEX IF NOT EXISTS idx_ml_training_examples_candidate_item
  ON ml_training_examples(candidate_item_id);

CREATE INDEX IF NOT EXISTS idx_ml_training_examples_split
  ON ml_training_examples(split);

CREATE INDEX IF NOT EXISTS idx_model_registry_is_active
  ON model_registry(is_active);

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE 'Feature "personalized-learning-recommendation-foundation" migration completed successfully!';
  RAISE NOTICE 'Created tables: learner_recommendations, learner_item_events, recommendation_impressions, recommendation_outcomes, recommendation_feedback, learning_items, ml_training_examples, model_registry';
END $$;
