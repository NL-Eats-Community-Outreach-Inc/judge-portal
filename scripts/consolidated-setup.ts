#!/usr/bin/env tsx

/**
 * Complete Database Setup Script for JudgePortal
 *
 * This script performs a complete database setup in the correct order:
 * 1. Pushes Drizzle schema to create base tables
 * 2. Applies consolidated SQL migration for additional features
 * 3. Optionally seeds with test data
 *
 * Usage:
 *   npm run db:complete-setup           # Setup database
 *   npm run db:complete-setup --seed    # Setup with test data
 */

import { config } from 'dotenv';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

// Load environment variables
config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
const TEST_PROJECT_REF = 'lqqmxxbxvsnoivebdywb';

// Validate environment variables
if (!DATABASE_URL) {
  console.error('❌ Missing required environment variables!');
  console.error('\nPlease ensure the following are set in .env.local:');
  console.error('  - DATABASE_URL (for direct SQL execution)');
  console.error('\nYou can find this in your Supabase project settings > Database.');
  process.exit(1);
}

// `drizzle-kit push --force` rebuilds tables: only the test project, unless a
// genuinely new project is being set up (DB_SETUP_ALLOW_ANY_PROJECT=true)
if (
  !DATABASE_URL.includes(TEST_PROJECT_REF) &&
  process.env.DB_SETUP_ALLOW_ANY_PROJECT !== 'true'
) {
  console.error(
    `Refusing: DATABASE_URL does not point at the test project (${TEST_PROJECT_REF}). ` +
      'Set DB_SETUP_ALLOW_ANY_PROJECT=true to set up a new project.'
  );
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const shouldSeed = args.includes('--seed');

/**
 * Execute a SQL file against the database using direct PostgreSQL connection
 */
async function executeSQLFile(filepath: string): Promise<boolean> {
  let sql_connection: ReturnType<typeof postgres> | null = null;

  try {
    const sqlContent = readFileSync(filepath, 'utf-8');

    console.log(`  📝 Applying consolidated migration...`);
    console.log(`  ℹ️  Note: This applies the SQL migration through direct PostgreSQL connection`);

    // Create direct PostgreSQL connection
    if (!DATABASE_URL) {
      console.error(`    ❌ DATABASE_URL not found in environment variables`);
      console.error(`    💡 Add DATABASE_URL to your .env.local file`);
      return false;
    }

    sql_connection = postgres(DATABASE_URL);

    // Execute the SQL file. It runs as one transaction: any error means
    // nothing in it applied, and every statement is guarded (IF NOT EXISTS,
    // OR REPLACE, DROP … IF EXISTS), so no error is ever "safe" to ignore.
    await sql_connection.unsafe(sqlContent);

    console.log(`    ✅ Migration applied successfully`);
    return true;
  } catch (error) {
    console.error(`    ❌ Migration failed:`, error instanceof Error ? error.message : error);
    console.error(`    💡 Try running the SQL manually in Supabase Dashboard > SQL Editor`);
    return false;
  } finally {
    // Close the connection
    if (sql_connection) {
      await sql_connection.end();
    }
  }
}

/**
 * Main setup function
 */
async function setupDatabase() {
  console.log('🚀 JudgePortal Complete Database Setup\n');
  console.log('📋 Configuration:');
  console.log(`  - Database URL: ${DATABASE_URL ? 'Connected' : 'Not found'}`);
  console.log(`  - Seed data: ${shouldSeed ? 'Yes' : 'No'}`);
  console.log('');

  try {
    // Step 1: Push Drizzle schema. `--force` skips drizzle-kit's interactive
    // confirmation, which needs a TTY (without it the push silently applies
    // nothing and the tables end up created by the SQL file instead, with
    // different constraint names than production). This script is for a
    // fresh database, where there is nothing for the push to destroy.
    console.log('📦 Step 1: Pushing Drizzle schema...');
    execSync('npx drizzle-kit push --force', { stdio: 'inherit' });
    console.log('  ✅ Drizzle schema pushed successfully\n');

    // Step 2: Apply consolidated migration
    console.log('🔧 Step 2: Applying consolidated migration...');
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', 'consolidated_setup.sql');

    const migrationSuccess = await executeSQLFile(migrationPath);

    if (!migrationSuccess) {
      console.error('\n❌ Automated migration failed!');
      printManualInstructions(migrationPath);
      process.exit(1);
    }

    console.log('  ✅ Migration applied successfully\n');

    // Step 3: Seed data (optional)
    if (shouldSeed) {
      console.log('Applying seed prerequisite feature migrations...');
      try {
        execSync('npm run db:update submissions', {
          stdio: 'inherit',
        });
        console.log('  Seed prerequisite migrations applied successfully\n');
      } catch (error) {
        console.error('  Seed prerequisite migrations failed:', error);
        throw error;
      }

      console.log('🌱 Step 3: Seeding test data...');
      try {
        execSync('npm run db:seed', {
          stdio: 'inherit',
        });
        console.log('  ✅ Test data seeded successfully\n');
      } catch (error) {
        console.error('  ❌ Seeding failed:', error);
        throw error;
      }
    }

    // Success!
    console.log('✨ Database setup completed successfully!\n');
    console.log('📝 Next Steps:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Sign up for an account at http://localhost:3000/auth/sign-up');
    console.log('3. Promote yourself to admin in Supabase dashboard:');
    console.log('   - Go to Table Editor → users table');
    console.log('   - Find your user and change role to "admin"');
    console.log('4. Create an event and start judging!\n');
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

/**
 * Alternative: Manual SQL execution instructions
 * If automated execution fails, provide clear manual steps
 */
function printManualInstructions(filepath: string): void {
  console.log('\n📋 Manual Setup Instructions:');
  console.log('If the automated setup fails, follow these steps:');
  console.log('');
  console.log('1. Open your Supabase Dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Copy and paste the contents of:');
  console.log(`   ${filepath}`);
  console.log('4. Click "Run" to execute the SQL');
  console.log('5. Then run: npm run db:seed (if you want test data)');
  console.log('');
}

// Run the setup
setupDatabase().catch((error) => {
  console.error('\n❌ Setup failed:', error);
  process.exit(1);
});
