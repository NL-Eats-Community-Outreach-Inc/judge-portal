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

  /*
    Define four different user types
        1. Cold start: rule-based (default)
        2. Dropout: started course, but hasn't returned in a long time, rule-based
        3. Casual: started course, completed it, but data is sparse, rule-based
        4. Power: frequent user, has completed courses, ML
  */
  const userColdStart = `lw-user-${seedTag}-cold`;
  const userDropout = `lw-user-${seedTag}-dropout`;
  const userCasual = `lw-user-${seedTag}-casual`;
  const userPower = `lw-user-${seedTag}-power`;

  /*
    Define Course IDs corresponding to the catalog
  */
  const courseEpi = `BIO-340-${seedTag}`;
  const course3D = `BIO-450-${seedTag}`;
  const courseMisinfo = `HIS-590-${seedTag}`;

  const client = postgres(connectionString, { max: 1 });

  try {
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
    SEED CATALOG FROM CURRICULUM
    */
    console.log('Seeding learning items catalog...');
    await client`
      INSERT INTO learning_items (item_id, item_type, title, description, category, difficulty_level, is_active)
      VALUES
      (
        ${courseEpi}, 'course', 
        'BIO 340: Epigenetics and DNA Methylation', 
        'Investigating heritable changes in gene expression, focusing on DNA methylation patterns.', 
        'biology', 'intermediate', true
      ),
      (
        ${course3D}, 'course', 
        'BIO 450: 3D Genome Architecture and Chromatin Dynamics', 
        'A study of how DNA folds within the nucleus, examining cis and trans contacts.', 
        'biology', 'advanced', true
      ),
      (
        ${courseMisinfo}, 'course', 
        'HIS 590: Misinformation, Citations, and the Crisis of Truth', 
        'Examining the propagation of incorrect information in historical records and modern literature, including synthetic media.', 
        'history', 'advanced', true
      )
    `;

    /*
        SEED LEARNER PROGRESS 
    */
    console.log('Seeding learner progress profiles...');
    await client`
      INSERT INTO learner_progress (learnworlds_user_id, course_id, progress_percentage, completion_status)
      VALUES
      -- Cold Start: 0 progress
      (${userColdStart}, ${courseEpi}, 0, 'not_started'),
      
      -- Dropout: Stuck at 65% on Epigenetics
      (${userDropout}, ${courseEpi}, 65, 'in_progress'),
      
      -- Casual: Finished Epigenetics completely
      (${userCasual}, ${courseEpi}, 100, 'completed'),
      
      -- Power User: Finished Epigenetics, in 3D Genome architecture, trying History
      (${userPower}, ${courseEpi}, 100, 'completed'),
      (${userPower}, ${course3D}, 85, 'in_progress'),
      (${userPower}, ${courseMisinfo}, 10, 'in_progress')
    `;

    /*
        SEED TEMPORAL EVENTS (BEHAVIOR)
    */
    console.log('Seeding temporal interaction events...');
    await client`
      INSERT INTO learner_item_events (learnworlds_user_id, item_id, item_type, event_type, event_timestamp, source)
      VALUES
      -- Dropout: One event exactly 60 days ago
      (${userDropout}, ${courseEpi}, 'course', 'started', timezone('utc'::text, now()) - interval '60 days', 'learnworlds'),

      -- Casual: A few events spread over the last 3 months
      (${userCasual}, ${courseEpi}, 'course', 'completed', timezone('utc'::text, now()) - interval '45 days', 'learnworlds'),
      (${userCasual}, ${courseEpi}, 'course', 'viewed', timezone('utc'::text, now()) - interval '14 days', 'widget'),

      -- Power User: Dense history in the last 7 days (The ML Candidate)
      (${userPower}, ${courseEpi}, 'course', 'completed', timezone('utc'::text, now()) - interval '7 days', 'learnworlds'),
      (${userPower}, ${course3D}, 'course', 'started', timezone('utc'::text, now()) - interval '6 days', 'learnworlds'),
      (${userPower}, ${courseMisinfo}, 'course', 'viewed', timezone('utc'::text, now()) - interval '2 days', 'widget'),
      (${userPower}, ${course3D}, 'course', 'progressed', timezone('utc'::text, now()) - interval '1 day', 'learnworlds'),
      (${userPower}, ${course3D}, 'course', 'progressed', timezone('utc'::text, now()) - interval '2 hours', 'learnworlds')
    `;

    /*
        SEED ML TRAINING PIPELINE & REGISTRY
    */
    console.log('Seeding ML training examples and active recommendations...');

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

    await client`
      INSERT INTO learner_recommendations (learnworlds_user_id, recommended_item_id, recommended_title, rationale, source, rule_matched, model_version)
      VALUES 
      -- Fallback Rule for Cold Start (Defaults to popular foundational biology)
      (${userColdStart}, ${courseEpi}, 'BIO 340: Epigenetics and DNA Methylation', 'Popular starting point for new learners.', 'fallback', 'default_popular', null),
      
      -- Inactivity Rule for Dropout
      (${userDropout}, ${courseEpi}, 'BIO 340: Epigenetics and DNA Methylation', 'Pick up where you left off!', 'rule', 'resume_inactivity', null),
      
      -- Progression Rule for Casual Learner
      (${userCasual}, ${course3D}, 'BIO 450: 3D Genome Architecture', 'Based on your completion of Epigenetics.', 'rule', 'next_step_progression', null),

      -- ML Recommendation for Power User
      (${userPower}, ${course3D}, 'BIO 450: 3D Genome Architecture', 'Recommended based on your recent intensive study patterns.', 'ml', null, ${`v${seedTag}`})
    `;

    console.log('Database seeding completed successfully!');
    console.log('--- Test Matrix Summary ---');
    console.log(`Cold Start (Fallback) : ${userColdStart}`);
    console.log(`Dropout (Rule)        : ${userDropout}`);
    console.log(`Casual (Rule)         : ${userCasual}`);
    console.log(`Power User (ML)       : ${userPower}`);
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.end();
  }
};

seedDatabase();
