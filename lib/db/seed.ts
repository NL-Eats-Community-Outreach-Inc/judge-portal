import { db } from './index';
import { events, teams, criteria, submissions, submissionAiScores } from './schema';
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
  console.log('Setting up RLS policies and seeding database...');
  const seedTag = Date.now().toString();
  const lwUserA = `lw-user-${seedTag}-a`;
  const lwUserB = `lw-user-${seedTag}-b`;
  const courseA = `course-${seedTag}-a`;
  const courseB = `course-${seedTag}-b`;

  // Create direct connection for RLS policies (needs superuser permissions)
  const client = postgres(connectionString, { max: 1 });

  try {
    // Enable RLS on tables
    console.log('Enabling Row Level Security...');
    await client`ALTER TABLE users ENABLE ROW LEVEL SECURITY`;
    await client`ALTER TABLE scores ENABLE ROW LEVEL SECURITY`;
    await client`ALTER TABLE events ENABLE ROW LEVEL SECURITY`;
    await client`ALTER TABLE teams ENABLE ROW LEVEL SECURITY`;
    await client`ALTER TABLE criteria ENABLE ROW LEVEL SECURITY`;

    // Create RLS policies for users table
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
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `;

    // Create RLS policies for scores table
    console.log('Creating score policies...');
    await client`DROP POLICY IF EXISTS "Judges can view own scores" ON scores`;
    await client`DROP POLICY IF EXISTS "Judges can insert own scores" ON scores`;
    await client`DROP POLICY IF EXISTS "Judges can update own scores" ON scores`;
    await client`DROP POLICY IF EXISTS "Admins can view all scores" ON scores`;
    await client`
      CREATE POLICY "Judges can view own scores" ON scores 
      FOR SELECT USING (auth.uid() = judge_id)
    `;
    await client`
      CREATE POLICY "Judges can insert own scores" ON scores 
      FOR INSERT WITH CHECK (auth.uid() = judge_id)
    `;
    await client`
      CREATE POLICY "Judges can update own scores" ON scores 
      FOR UPDATE USING (auth.uid() = judge_id)
    `;
    await client`
      CREATE POLICY "Admins can view all scores" ON scores 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `;

    // Public read policies for events, teams, criteria (all users need to see these)
    console.log('Creating public read policies...');
    await client`DROP POLICY IF EXISTS "All authenticated users can view events" ON events`;
    await client`DROP POLICY IF EXISTS "All authenticated users can view teams" ON teams`;
    await client`DROP POLICY IF EXISTS "All authenticated users can view criteria" ON criteria`;
    await client`
      CREATE POLICY "All authenticated users can view events" ON events 
      FOR SELECT USING (auth.uid() IS NOT NULL)
    `;
    await client`
      CREATE POLICY "All authenticated users can view teams" ON teams 
      FOR SELECT USING (auth.uid() IS NOT NULL)
    `;
    await client`
      CREATE POLICY "All authenticated users can view criteria" ON criteria 
      FOR SELECT USING (auth.uid() IS NOT NULL)
    `;

    // Admin-only policies for managing events, teams, criteria
    await client`DROP POLICY IF EXISTS "Admins can manage events" ON events`;
    await client`DROP POLICY IF EXISTS "Admins can manage teams" ON teams`;
    await client`DROP POLICY IF EXISTS "Admins can manage criteria" ON criteria`;
    await client`
      CREATE POLICY "Admins can manage events" ON events 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `;
    await client`
      CREATE POLICY "Admins can manage teams" ON teams 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `;
    await client`
      CREATE POLICY "Admins can manage criteria" ON criteria 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `;

    console.log('RLS policies created successfully!');

    // Seed initial data
    console.log('Seeding initial data...');

    // Create sample event
    const [sampleEvent] = await client<{ id: string; name: string }[]>`
      INSERT INTO events (name, description, status)
      VALUES ('Demo Hackathon 2025', 'A demo hackathon for testing the judging system', 'setup')
      RETURNING id, name
    `;

    const eventId = sampleEvent.id;

    // Create sample teams
    const sampleTeams = await client<{ id: string }[]>`
      INSERT INTO teams (
        event_id,
        name,
        description,
        demo_url,
        repo_url,
        presentation_order
      )
      VALUES
      (
        ${eventId},
        'Team Alpha',
        'Building the next generation AI assistant',
        'https://demo.alpha.com',
        'https://github.com/team-alpha/project',
        1
      ),
      (
        ${eventId},
        'Team Beta',
        'Revolutionary blockchain solution for sustainability',
        'https://demo.beta.com',
        'https://github.com/team-beta/project',
        2
      ),
      (
        ${eventId},
        'Team Gamma',
        'Mobile app for enhancing community connections',
        'https://demo.gamma.com',
        'https://github.com/team-gamma/project',
        3
      )
      RETURNING id
    `;

    // Create sample criteria
    const sampleCriteria = await client<{ id: string }[]>`
      INSERT INTO criteria (
        event_id,
        name,
        description,
        min_score,
        max_score,
        display_order,
        weight,
        category
      )
      VALUES
      (
        ${eventId},
        'Innovation',
        'How innovative and creative is the solution?',
        1,
        10,
        1,
        25,
        'technical'
      ),
      (
        ${eventId},
        'Technical Implementation',
        'Quality of the technical execution and code',
        1,
        10,
        2,
        50,
        'technical'
      ),
      (
        ${eventId},
        'User Experience',
        'How intuitive and user-friendly is the solution?',
        1,
        10,
        3,
        25,
        'technical'
      ),
      (
        ${eventId},
        'Business Viability',
        'Potential for real-world application and scalability',
        1,
        10,
        4,
        100,
        'business'
      )
      RETURNING id
    `;

    // Create sample submission (use first team)
    const sampleSubmission = await db
      .insert(submissions)
      .values({
        eventId,
        teamId: sampleTeams[0].id,
        submissionText:
          'An AI-powered freshwater collection system using atmospheric condensation and solar-powered filtration.',
      })
      .returning();

    // Create sample AI score for submission
    await db.insert(submissionAiScores).values({
      submissionId: sampleSubmission[0].id,
      score: '87.5',
    });

    console.log('Sample data created:');
    console.log(`- Event: ${sampleEvent.name}`);
    console.log(`- Teams: ${sampleTeams.length}`);
    console.log(`- Criteria: ${sampleCriteria.length}`);

    // Seed LearnWorlds ingestion + transformed progress data
    console.log('Seeding LearnWorlds ingestion and transformed progress data...');

    const [syncRun] = await client<{ id: string }[]>`
      INSERT INTO learnworlds_sync_runs (
        trigger_mode,
        status,
        total_records,
        valid_records,
        invalid_records
      )
      VALUES ('manual', 'succeeded', 4, 3, 1)
      RETURNING id
    `;

    const [rawPayloadA] = await client<{ id: string }[]>`
      INSERT INTO learnworlds_raw_payloads (
        sync_run_id,
        source_endpoint,
        http_status,
        learner_external_id,
        course_external_id,
        module_external_id,
        lesson_external_id,
        completion_status,
        progress_percentage,
        record_hash,
        payload
      )
      VALUES (
        ${syncRun.id},
        '/admin/learnworlds/ingest',
        200,
        ${lwUserA},
        ${courseA},
        ${`module-${seedTag}-1`},
        ${`lesson-${seedTag}-1`},
        'completed',
        100,
        ${`hash-${seedTag}-1`},
        ${JSON.stringify({ learner_id: lwUserA, course_id: courseA, module_id: `module-${seedTag}-1` })}::jsonb
      )
      RETURNING id
    `;

    await client`
      INSERT INTO learnworlds_raw_payloads (
        sync_run_id,
        source_endpoint,
        http_status,
        learner_external_id,
        course_external_id,
        module_external_id,
        lesson_external_id,
        completion_status,
        progress_percentage,
        record_hash,
        payload
      )
      VALUES
      (
        ${syncRun.id},
        '/admin/learnworlds/ingest',
        200,
        ${lwUserA},
        ${courseA},
        ${`module-${seedTag}-2`},
        ${`lesson-${seedTag}-2`},
        'in_progress',
        65,
        ${`hash-${seedTag}-2`},
        ${JSON.stringify({ learner_id: lwUserA, course_id: courseA, module_id: `module-${seedTag}-2` })}::jsonb
      ),
      (
        ${syncRun.id},
        '/admin/learnworlds/ingest',
        200,
        ${lwUserB},
        ${courseB},
        ${`module-${seedTag}-3`},
        ${`lesson-${seedTag}-3`},
        'completed',
        100,
        ${`hash-${seedTag}-3`},
        ${JSON.stringify({ learner_id: lwUserB, course_id: courseB, module_id: `module-${seedTag}-3` })}::jsonb
      ),
      (
        ${syncRun.id},
        '/admin/learnworlds/ingest',
        200,
        NULL,
        ${courseA},
        NULL,
        NULL,
        'not_started',
        0,
        ${`hash-${seedTag}-4`},
        ${JSON.stringify({ learner_id: null, course_id: courseA })}::jsonb
      )
    `;

    await client`
      INSERT INTO learner_progress (
        learnworlds_user_id,
        course_id,
        progress_percentage,
        completed_modules,
        completion_status,
        raw_payload_id
      )
      VALUES
      (${lwUserA}, ${courseA}, 65, 1, 'in_progress', ${rawPayloadA.id}),
      (${lwUserB}, ${courseB}, 100, 1, 'completed', ${rawPayloadA.id})
      ON CONFLICT (learnworlds_user_id, course_id)
      DO UPDATE SET
        progress_percentage = EXCLUDED.progress_percentage,
        completed_modules = EXCLUDED.completed_modules,
        completion_status = EXCLUDED.completion_status,
        raw_payload_id = EXCLUDED.raw_payload_id,
        source_synced_at = timezone('utc'::text, now())
    `;

    // Seed personalized recommendation data
    console.log('Seeding personalized recommendation data...');

    await client`
      INSERT INTO learning_items (
        item_id,
        item_type,
        title,
        description,
        category,
        difficulty_level,
        estimated_duration_minutes,
        is_active
      )
      VALUES
      (
        ${`li-course-${seedTag}`},
        'course',
        'Foundations of Product Thinking',
        'Core course for product thinking and execution.',
        'product',
        'beginner',
        180,
        true
      ),
      (
        ${`li-module-${seedTag}`},
        'module',
        'Problem Discovery Workshop',
        'Hands-on module for user problem identification.',
        'product',
        'beginner',
        60,
        true
      ),
      (
        ${`li-lesson-${seedTag}`},
        'lesson',
        'Interview Scripting Basics',
        'Lesson on preparing customer interview scripts.',
        'research',
        'intermediate',
        30,
        true
      )
    `;

    const [recommendation] = await client<{ id: string }[]>`
      INSERT INTO learner_recommendations (
        learnworlds_user_id,
        recommended_item_id,
        recommended_item_type,
        recommended_title,
        rationale,
        source,
        rule_matched,
        model_version,
        score
      )
      VALUES (
        ${lwUserA},
        ${`li-lesson-${seedTag}`},
        'lesson',
        'Interview Scripting Basics',
        'Recommended because learner recently completed prerequisite module.',
        'rule',
        'recent_completion_plus_gap',
        ${`rules-${seedTag}`},
        0.870000
      )
      RETURNING id
    `;

    const [impression] = await client<{ id: string }[]>`
      INSERT INTO recommendation_impressions (
        recommendation_id,
        learnworlds_user_id,
        item_id,
        item_type,
        source,
        model_version,
        score,
        rank_position
      )
      VALUES (
        ${recommendation.id},
        ${lwUserA},
        ${`li-lesson-${seedTag}`},
        'lesson',
        'api',
        ${`rules-${seedTag}`},
        0.870000,
        1
      )
      RETURNING id
    `;

    await client`
      INSERT INTO recommendation_outcomes (
        recommendation_impression_id,
        learnworlds_user_id,
        item_id,
        outcome_type,
        label_value,
        metadata
      )
      VALUES (
        ${impression.id},
        ${lwUserA},
        ${`li-lesson-${seedTag}`},
        'clicked',
        1,
        ${JSON.stringify({ channel: 'dashboard_widget', device: 'web' })}::jsonb
      )
    `;

    await client`
      INSERT INTO recommendation_feedback (
        recommendation_id,
        learnworlds_user_id,
        recommended_item_id,
        feedback_type,
        rating,
        comment
      )
      VALUES (
        ${recommendation.id},
        ${lwUserA},
        ${`li-lesson-${seedTag}`},
        'helpful',
        5,
        'Very relevant to my current learning track.'
      )
    `;

    await client`
      INSERT INTO learner_item_events (
        learnworlds_user_id,
        item_id,
        item_type,
        event_type,
        event_value,
        source,
        metadata
      )
      VALUES
      (
        ${lwUserA},
        ${`li-lesson-${seedTag}`},
        'lesson',
        'viewed',
        1,
        'widget',
        ${JSON.stringify({ surface: 'recommendation_carousel' })}::jsonb
      ),
      (
        ${lwUserA},
        ${`li-lesson-${seedTag}`},
        'lesson',
        'recommendation_clicked',
        1,
        'api',
        ${JSON.stringify({ recommendation_id: recommendation.id })}::jsonb
      ),
      (
        ${lwUserB},
        ${`li-module-${seedTag}`},
        'module',
        'completed',
        1,
        'learnworlds',
        ${JSON.stringify({ completion_source: 'sync_import' })}::jsonb
      )
    `;

    await client`
      INSERT INTO ml_training_examples (
        learnworlds_user_id,
        candidate_item_id,
        snapshot_time,
        total_items_started,
        total_items_completed,
        completion_rate,
        avg_progress_percentage,
        days_since_last_activity,
        active_courses_count,
        completed_courses_count,
        preferred_category,
        preferred_difficulty,
        item_type,
        item_category,
        item_difficulty,
        item_duration_minutes,
        has_prerequisite,
        is_prerequisite_completed,
        candidate_popularity_7d,
        candidate_completion_rate_30d,
        same_category_as_recent_activity,
        same_difficulty_as_recent_activity,
        learnworlds_user_has_seen_item_before,
        learnworlds_user_started_similar_items_before,
        learnworlds_user_completed_prerequisite,
        candidate_is_next_in_path,
        candidate_previously_ignored,
        label_engaged,
        split
      )
      VALUES
      (
        ${lwUserA},
        ${`li-lesson-${seedTag}`},
        timezone('utc'::text, now()),
        12,
        8,
        0.666667,
        72.500000,
        1,
        2,
        1,
        'product',
        'beginner',
        'lesson',
        'research',
        'intermediate',
        30,
        true,
        true,
        54,
        0.410000,
        true,
        false,
        true,
        true,
        true,
        true,
        false,
        1,
        'train'
      ),
      (
        ${lwUserB},
        ${`li-module-${seedTag}`},
        timezone('utc'::text, now()),
        5,
        2,
        0.400000,
        48.000000,
        3,
        1,
        0,
        'product',
        'beginner',
        'module',
        'product',
        'beginner',
        60,
        false,
        false,
        33,
        0.250000,
        true,
        true,
        false,
        true,
        false,
        false,
        false,
        0,
        'validation'
      )
    `;

    await client`
      INSERT INTO model_registry (
        model_version,
        model_type,
        feature_schema_version,
        artifact_path,
        training_start,
        training_end,
        is_active,
        metrics
      )
      VALUES (
        ${`v${seedTag}`},
        'logistic_regression',
        'features-v1',
        ${`s3://ml-artifacts/recommendations/${seedTag}/model.pkl`},
        timezone('utc'::text, now()) - interval '2 hours',
        timezone('utc'::text, now()) - interval '1 hour',
        true,
        ${JSON.stringify({ auc: 0.84, precision_at_5: 0.62, recall_at_5: 0.55 })}::jsonb
      )
    `;

    console.log('LearnWorlds + recommendation seed data created:');
    console.log(`- Sync run: ${syncRun.id}`);
    console.log(`- Learners: ${lwUserA}, ${lwUserB}`);
    console.log(`- Recommendation ID: ${recommendation.id}`);

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.end();
  }
};

seedDatabase();
