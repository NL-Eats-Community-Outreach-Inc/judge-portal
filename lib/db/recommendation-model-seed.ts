import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: ['.env.local', '.env'] });

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  throw new Error(
    'Missing database connection string. Set one of DATABASE_URL, POSTGRES_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL_NON_POOLING.'
  );
}

const seedDatabase = async () => {
  console.log('Seeding recommendation model test data...');
  const seedTag = Date.now().toString();

  /*
    Define four different user types
        1. Cold start: no history → default_popular fallback rule
        2. Dropout: started course, hasn't returned in 60 days → resume_inactivity rule
        3. Casual: completed one course, sparse data → next_step_progression rule
        4. Power: dense recent history, 5+ events → ML path (falls back to high_progress in Phase 1)
  */
  const userColdStart = `lw-user-${seedTag}-cold`;
  const userDropout = `lw-user-${seedTag}-dropout`;
  const userCasual = `lw-user-${seedTag}-casual`;
  const userPower = `lw-user-${seedTag}-power`;

  /*
    Define Course IDs matching the catalog below.
    All tagged with seedTag to avoid collisions across runs.
    'BIO-340' is a static item (no tag) that matches DEFAULT_FALLBACK_ITEM_ID in RULES_CONFIG.
  */
  const courseEpi = `BIO-340-${seedTag}`;
  const course3D = `BIO-450-${seedTag}`;
  const courseMisinfo = `HIS-590-${seedTag}`;

  const client = postgres(connectionString, { max: 1 });

  try {
    // Note: RLS policies belong in migrations. Kept here for local dev convenience only.
    console.log('Creating user policies...');
    await client`DROP POLICY IF EXISTS "Users can view own profile" ON users`;
    await client`DROP POLICY IF EXISTS "Users can update own profile" ON users`;
    await client`DROP POLICY IF EXISTS "Admins can view all users" ON users`;
    await client`
      CREATE POLICY "Users can view own profile" ON users
      FOR SELECT USING (auth.uid() = id)
    `;
    await client`
      CREATE POLICY "Users can update own profile" ON users
      FOR UPDATE USING (auth.uid() = id)
    `;
    await client`
      CREATE POLICY "Admins can view all users" ON users
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `;

    /*
      SEED CATALOG
      Insert items without prerequisites first, then course3D which references courseEpi.
      'BIO-340' is the static fallback item hardcoded in RULES_CONFIG.DEFAULT_FALLBACK_ITEM_ID.
    */
    console.log('Seeding learning items catalog...');
    await client`
      INSERT INTO learning_items (item_id, item_type, title, description, category, difficulty_level, prerequisite_item_id, is_active)
      VALUES
      (
        'BIO-340', 'course',
        'Foundations Course',
        'A popular starting point for new learners.',
        'biology', 'beginner', NULL, true
      ),
      (
        ${courseEpi}, 'course',
        'BIO 340: Epigenetics and DNA Methylation',
        'Investigating heritable changes in gene expression, focusing on DNA methylation patterns.',
        'biology', 'intermediate', NULL, true
      ),
      (
        ${courseMisinfo}, 'course',
        'HIS 590: Misinformation, Citations, and the Crisis of Truth',
        'Examining the propagation of incorrect information in historical records and modern literature, including synthetic media.',
        'history', 'advanced', NULL, true
      )
      ON CONFLICT (item_id) DO NOTHING
    `;

    // Inserted separately so courseEpi is committed before course3D references it as a prerequisite.
    await client`
      INSERT INTO learning_items (item_id, item_type, title, description, category, difficulty_level, prerequisite_item_id, is_active)
      VALUES
      (
        ${course3D}, 'course',
        'BIO 450: 3D Genome Architecture and Chromatin Dynamics',
        'A study of how DNA folds within the nucleus, examining cis and trans contacts.',
        'biology', 'advanced', ${courseEpi}, true
      )
      ON CONFLICT (item_id) DO NOTHING
    `;

    /*
      SEED LEARNER PROGRESS
    */
    console.log('Seeding learner progress profiles...');
    await client`
      INSERT INTO learner_progress (learnworlds_user_id, course_id, progress_percentage, completion_status)
      VALUES
      -- Cold Start: no meaningful progress, no events
      (${userColdStart}, ${courseEpi}, 0, 'not_started'),

      -- Dropout: stuck at 65% on Epigenetics, last activity 60 days ago
      (${userDropout}, ${courseEpi}, 65, 'in_progress'),

      -- Casual: finished Epigenetics, nothing else in progress
      (${userCasual}, ${courseEpi}, 100, 'completed'),

      -- Power User: finished Epigenetics, 85% through 3D Genome, just started History
      (${userPower}, ${courseEpi}, 100, 'completed'),
      (${userPower}, ${course3D},  85,  'in_progress'),
      (${userPower}, ${courseMisinfo}, 10, 'in_progress')
    `;

    /*
      SEED TEMPORAL EVENTS (BEHAVIOR)
    */
    console.log('Seeding temporal interaction events...');
    await client`
      INSERT INTO learner_item_events (learnworlds_user_id, item_id, item_type, event_type, event_timestamp, source)
      VALUES
      -- Dropout: one event exactly 60 days ago (well past the 14-day inactivity threshold)
      (${userDropout}, ${courseEpi}, 'course', 'started', timezone('utc'::text, now()) - interval '60 days', 'learnworlds'),

      -- Casual: a few events over the last 3 months, sparse enough to stay rule-based
      (${userCasual}, ${courseEpi}, 'course', 'completed', timezone('utc'::text, now()) - interval '45 days', 'learnworlds'),
      (${userCasual}, ${courseEpi}, 'course', 'viewed',    timezone('utc'::text, now()) - interval '14 days', 'widget'),

      -- Power User: 5 events in the last 7 days (meets ML_READY_EVENT_THRESHOLD = 5)
      -- In Phase 1 the ML stub throws, so the engine falls back to high_progress (course3D at 85%)
      (${userPower}, ${courseEpi},     'course', 'completed',  timezone('utc'::text, now()) - interval '7 days',  'learnworlds'),
      (${userPower}, ${course3D},      'course', 'started',    timezone('utc'::text, now()) - interval '6 days',  'learnworlds'),
      (${userPower}, ${courseMisinfo}, 'course', 'viewed',     timezone('utc'::text, now()) - interval '2 days',  'widget'),
      (${userPower}, ${course3D},      'course', 'progressed', timezone('utc'::text, now()) - interval '1 day',   'learnworlds'),
      (${userPower}, ${course3D},      'course', 'progressed', timezone('utc'::text, now()) - interval '2 hours', 'learnworlds')
    `;

    /*
      SEED ML TRAINING PIPELINE & REGISTRY
    */
    console.log('Seeding ML model registry and training examples...');

    await client`
      INSERT INTO model_registry (model_version, model_type, feature_schema_version, artifact_path, is_active)
      VALUES (${`v${seedTag}`}, 'xgboost', 'features-v1', ${`s3://ml-artifacts/recommendations/${seedTag}/model.pkl`}, true)
    `;

    await client`
      INSERT INTO ml_training_examples (
        learnworlds_user_id, candidate_item_id, snapshot_time,
        days_since_last_activity, active_courses_count, completed_courses_count,
        preferred_category, item_category, same_category_as_recent_activity,
        label_engaged, split
      )
      VALUES (
        ${userPower}, ${course3D}, timezone('utc'::text, now()),
        0, 2, 1,
        'biology', 'biology', true,
        1, 'train'
      )
    `;

    /*
      SEED PRIOR RECOMMENDATIONS (EXPIRED)
      created_at is set 48 hours in the past so the orchestrator's 24-hour freshness check
      treats these as stale and calls the rule engine to regenerate — this exercises the actual
      rule paths rather than the freshness return path.

      Power user source is 'rule'/'high_progress' because the ML stub throws in Phase 1.
      Update to source='ml' and add model_version in Phase 4 when ML inference is live.
    */
    console.log('Seeding expired prior recommendations...');
    await client`
      INSERT INTO learner_recommendations (learnworlds_user_id, recommended_item_id, recommended_title, rationale, source, rule_matched, model_version, created_at)
      VALUES
      -- Cold Start: prior fallback (expired)
      (${userColdStart}, 'BIO-340', 'Foundations Course',
        'Popular starting point for new learners.',
        'fallback', 'default_popular', null,
        timezone('utc'::text, now()) - interval '48 hours'),

      -- Dropout: prior inactivity recommendation (expired)
      (${userDropout}, ${courseEpi}, 'BIO 340: Epigenetics and DNA Methylation',
        'Pick up where you left off!',
        'rule', 'resume_inactivity', null,
        timezone('utc'::text, now()) - interval '48 hours'),

      -- Casual: prior progression recommendation (expired)
      (${userCasual}, ${course3D}, 'BIO 450: 3D Genome Architecture and Chromatin Dynamics',
        'Based on your completion of Epigenetics.',
        'rule', 'next_step_progression', null,
        timezone('utc'::text, now()) - interval '48 hours'),

      -- Power User: prior high_progress recommendation (expired; ML path active in Phase 4)
      (${userPower}, ${course3D}, 'BIO 450: 3D Genome Architecture and Chromatin Dynamics',
        'You are so close to finishing! Complete this course today.',
        'rule', 'high_progress', null,
        timezone('utc'::text, now()) - interval '48 hours')
    `;

    console.log('\nDatabase seeding completed successfully!');
    console.log('\n--- Test Matrix ---');
    console.log(`Cold Start  (default_popular)      : ${userColdStart}`);
    console.log(`Dropout     (resume_inactivity)    : ${userDropout}`);
    console.log(`Casual      (next_step_progression): ${userCasual}`);
    console.log(`Power User  (high_progress → ML)   : ${userPower}`);
    console.log('\nCall GET /api/recommendation?learner_id=<id> for each user to verify rule paths.');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
};

seedDatabase();
