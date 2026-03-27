-- ================================================================
-- FEATURE: LearnWorlds ingestion foundation (IC-11 + IC-13 Phase 1)
-- Description: Adds sync runs, raw payload staging, and normalized learner progress tables
-- Dependencies: consolidated_setup.sql, 001_invite-link.sql, 002_multi-tenant-participants.sql
-- ================================================================

-- ================================================================
-- SECTION 1: CREATE LEARNWORLDS SYNC RUNS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS learnworlds_sync_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_mode TEXT DEFAULT 'manual' NOT NULL,
  status TEXT DEFAULT 'running' NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  finished_at TIMESTAMP WITH TIME ZONE,
  total_records INTEGER DEFAULT 0 NOT NULL,
  valid_records INTEGER DEFAULT 0 NOT NULL,
  invalid_records INTEGER DEFAULT 0 NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_lw_sync_runs_trigger_mode
    CHECK (trigger_mode IN ('manual', 'scheduled', 'webhook')),
  CONSTRAINT check_lw_sync_runs_status
    CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
  CONSTRAINT check_lw_sync_runs_record_counts
    CHECK (total_records >= 0 AND valid_records >= 0 AND invalid_records >= 0)
);

-- ================================================================
-- SECTION 2: CREATE RAW PAYLOAD STAGING TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS learnworlds_raw_payloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_run_id UUID REFERENCES learnworlds_sync_runs(id) ON DELETE SET NULL,
  source_endpoint TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  learner_external_id TEXT,
  course_external_id TEXT,
  module_external_id TEXT,
  lesson_external_id TEXT,
  completion_status TEXT,
  progress_percentage INTEGER,
  last_activity_timestamp TIMESTAMP WITH TIME ZONE,
  record_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_lw_raw_payloads_http_status
    CHECK (http_status >= 100 AND http_status <= 599),
  CONSTRAINT check_lw_raw_payloads_progress_percentage
    CHECK (
      progress_percentage IS NULL OR
      (progress_percentage >= 0 AND progress_percentage <= 100)
    ),
  CONSTRAINT learnworlds_raw_payloads_sync_run_id_record_hash_unique
    UNIQUE (sync_run_id, record_hash)
);

-- ================================================================
-- SECTION 3: CREATE NORMALIZED LEARNER PROGRESS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS learner_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  learner_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  progress_percentage INTEGER DEFAULT 0 NOT NULL,
  completed_modules INTEGER DEFAULT 0 NOT NULL,
  completion_status TEXT DEFAULT 'in_progress' NOT NULL,
  last_activity_timestamp TIMESTAMP WITH TIME ZONE,
  source_synced_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  raw_payload_id UUID REFERENCES learnworlds_raw_payloads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT learner_progress_learner_id_course_id_unique UNIQUE (learner_id, course_id),
  CONSTRAINT check_learner_progress_percentage
    CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  CONSTRAINT check_learner_progress_completed_modules
    CHECK (completed_modules >= 0),
  CONSTRAINT check_learner_progress_completion_status
    CHECK (completion_status IN ('in_progress', 'completed', 'failed', 'not_started'))
);

-- ================================================================
-- SECTION 4: INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_lw_sync_runs_status
  ON learnworlds_sync_runs(status);

CREATE INDEX IF NOT EXISTS idx_lw_sync_runs_started_at
  ON learnworlds_sync_runs(started_at);

CREATE INDEX IF NOT EXISTS idx_lw_raw_payloads_sync_run
  ON learnworlds_raw_payloads(sync_run_id);

CREATE INDEX IF NOT EXISTS idx_lw_raw_payloads_learner
  ON learnworlds_raw_payloads(learner_external_id);

CREATE INDEX IF NOT EXISTS idx_lw_raw_payloads_course
  ON learnworlds_raw_payloads(course_external_id);

CREATE INDEX IF NOT EXISTS idx_lw_raw_payloads_received_at
  ON learnworlds_raw_payloads(received_at);

CREATE INDEX IF NOT EXISTS idx_learner_progress_learner
  ON learner_progress(learner_id);

CREATE INDEX IF NOT EXISTS idx_learner_progress_course
  ON learner_progress(course_id);

CREATE INDEX IF NOT EXISTS idx_learner_progress_last_activity
  ON learner_progress(last_activity_timestamp);

CREATE INDEX IF NOT EXISTS idx_learner_progress_source_synced
  ON learner_progress(source_synced_at);

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE 'Feature "learnworlds-ingestion-foundation" migration completed successfully!';
  RAISE NOTICE 'Created tables: learnworlds_sync_runs, learnworlds_raw_payloads, learner_progress';
END $$;
