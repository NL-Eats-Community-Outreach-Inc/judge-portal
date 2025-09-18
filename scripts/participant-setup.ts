#!/usr/bin/env tsx

/**
 * Participant Feature Setup Script
 *
 * This script sets up the participant feature for JudgePortal:
 * 1. Applies participant migration SQL
 * 2. Optionally seeds participant test data
 *
 * Usage:
 *   npm run db:participant-setup           # Setup participant feature
 *   npm run db:participant-setup --seed    # Setup with test data
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

// Load environment variables
config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

// Validate environment variables
if (!DATABASE_URL) {
  console.error('❌ Missing required environment variables!');
  console.error('\nPlease ensure the following are set in .env.local:');
  console.error('  - DATABASE_URL (for direct SQL execution)');
  console.error('\nYou can find this in your Supabase project settings > Database.');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const shouldSeed = args.includes('--seed');

/**
 * Check if participant enum value already exists
 */
async function checkParticipantEnumExists(): Promise<boolean> {
  let sql_connection: ReturnType<typeof postgres> | null = null;

  try {
    sql_connection = postgres(DATABASE_URL!);

    const result = await sql_connection`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'user_role' AND e.enumlabel = 'participant'
      ) as exists;
    `;

    return result[0]?.exists || false;
  } catch (error) {
    console.log(`    ⚠️  Could not check enum status, continuing with migration...`);
    return false;
  } finally {
    if (sql_connection) {
      await sql_connection.end();
    }
  }
}


/**
 * Execute a SQL file against the database using direct PostgreSQL connection
 */
async function executeSQLFile(filepath: string): Promise<boolean> {
  let sql_connection: ReturnType<typeof postgres> | null = null;

  try {
    const sqlContent = readFileSync(filepath, 'utf-8');

    console.log(`  📝 Applying participant migration...`);
    console.log(`  ℹ️  Note: This applies the SQL migration through direct PostgreSQL connection`);

    // Create direct PostgreSQL connection
    if (!DATABASE_URL) {
      console.error(`    ❌ DATABASE_URL not found in environment variables`);
      console.error(`    💡 Add DATABASE_URL to your .env.local file`);
      return false;
    }

    sql_connection = postgres(DATABASE_URL);

    // Execute the SQL file as one script
    await sql_connection.unsafe(sqlContent);

    console.log(`    ✅ Migration applied successfully`);
    return true;

  } catch (error: any) {
    // Check if it's a safe error (things already exist)
    const safeErrors = [
      'already exists',
      'duplicate key',
      'relation .* already exists',
      'type .* already exists',
      'function .* already exists',
      'constraint .* already exists',
      'index .* already exists',
      'policy .* already exists',
      'trigger .* already exists',
      'value .* already exists in enum',
      'enum value .* already exists'
    ];

    const isSafe = safeErrors.some(errorPattern => {
      const regex = new RegExp(errorPattern, 'i');
      return regex.test(error.message || '');
    });

    if (!isSafe) {
      console.error(`    ❌ Migration failed:`, error.message);
      console.error(`    💡 Try running the SQL manually in Supabase Dashboard > SQL Editor`);
      return false;
    } else {
      console.log(`    ⚠️  Some objects already exist (this is normal): ${error.message}`);
      return true;
    }
  } finally {
    // Close the connection
    if (sql_connection) {
      await sql_connection.end();
    }
  }
}

/**
 * Seed participant test data
 */
async function seedParticipantData(): Promise<boolean> {
  let sql_connection: ReturnType<typeof postgres> | null = null;

  try {
    console.log(`  🌱 Seeding participant test data...`);

    sql_connection = postgres(DATABASE_URL!);

    // Create test participant users
    await sql_connection`
      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      ) VALUES (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'participant1@example.com',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"role":"participant"}',
        now(),
        now(),
        '',
        '',
        '',
        ''
      ), (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'participant2@example.com',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"role":"participant"}',
        now(),
        now(),
        '',
        '',
        '',
        ''
      ), (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'participant3@example.com',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"role":"participant"}',
        now(),
        now(),
        '',
        '',
        '',
        ''
      )
      ON CONFLICT (email) DO NOTHING;
    `;

    // Add corresponding users table entries
    await sql_connection`
      INSERT INTO users (id, email, role)
      SELECT id, email, 'participant'::user_role
      FROM auth.users
      WHERE email IN ('participant1@example.com', 'participant2@example.com', 'participant3@example.com')
      ON CONFLICT (id) DO UPDATE SET role = 'participant';
    `;

    // Update an existing event to enable registration
    await sql_connection`
      UPDATE events
      SET
        registration_open = true,
        registration_close_at = now() + interval '7 days',
        max_team_size = 4
      WHERE id = (SELECT id FROM events LIMIT 1);
    `;

    console.log(`    ✅ Participant test data seeded successfully`);
    return true;

  } catch (error: any) {
    console.error(`    ❌ Seeding failed:`, error.message);
    console.error(`    💡 You can still create participants manually through the UI`);
    return false;
  } finally {
    if (sql_connection) {
      await sql_connection.end();
    }
  }
}

/**
 * Main setup function
 */
async function setupParticipantFeature() {
  console.log('🚀 JudgePortal Participant Feature Setup\n');
  console.log('📋 Configuration:');
  console.log(`  - Database URL: ${DATABASE_URL ? 'Connected' : 'Not found'}`);
  console.log(`  - Seed data: ${shouldSeed ? 'Yes' : 'No'}`);
  console.log('');

  try {
    // Step 1: Check if participant enum exists (must be added manually first)
    console.log('🔧 Step 1: Checking participant enum value...');
    const enumExists = await checkParticipantEnumExists();

    if (!enumExists) {
      console.log('  ⚠️  Participant enum value not found, will attempt to add it...');

      // Try to add the enum value
      let sql_connection: ReturnType<typeof postgres> | null = null;
      try {
        sql_connection = postgres(DATABASE_URL!);
        await sql_connection`ALTER TYPE user_role ADD VALUE 'participant';`;
        console.log('  ✅ Successfully added participant enum value\n');
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log('  ✅ Participant enum value already exists\n');
        } else {
          console.error('\n❌ Failed to add participant enum value!');
          console.error('\nYou need to manually add the participant enum:');
          console.error('1. Open your Supabase Dashboard');
          console.error('2. Navigate to SQL Editor');
          console.error('3. Run this command:');
          console.error("   ALTER TYPE user_role ADD VALUE 'participant';");
          console.error('4. Then re-run: npm run db:participant-setup');
          console.error('');
          console.error('Error details:', error.message);
          return;
        }
      } finally {
        if (sql_connection) {
          await sql_connection.end();
        }
      }
    } else {
      console.log('  ✅ Participant enum found\n');
    }

    // Step 2: Apply participant migration
    console.log('🔧 Step 2: Applying participant migration...');
    const migrationPath = join(
      process.cwd(),
      'supabase',
      'migrations',
      'participant_setup.sql'
    );

    const migrationSuccess = await executeSQLFile(migrationPath);

    if (!migrationSuccess) {
      console.error('\n❌ Automated migration failed!');
      printManualInstructions(migrationPath);
      console.error('You can still continue with seeding after running SQL manually.');
      return;
    }

    console.log('  ✅ Migration applied successfully\n');

    // Step 3: Seed data (optional)
    if (shouldSeed) {
      console.log('🌱 Step 3: Seeding participant test data...');
      const seedSuccess = await seedParticipantData();

      if (seedSuccess) {
        console.log('  ✅ Test data seeded successfully\n');
      } else {
        console.log('  ⚠️  Seeding had some issues, but migration is complete\n');
      }
    }

    // Success!
    console.log('✨ Participant feature setup completed successfully!\n');
    console.log('📝 What was added:');
    console.log('1. 📝 Registration controls to events table');
    console.log('2. 👥 team_members table for team management');
    console.log('3. 🔒 Row Level Security policies');
    console.log('4. 🛠️ Helper functions for business logic');
    console.log('5. 🔧 Enhanced handle_new_user trigger (prevents redirect loops)');

    if (shouldSeed) {
      console.log('\n🧪 Test accounts created:');
      console.log('- participant1@example.com (password: password123)');
      console.log('- participant2@example.com (password: password123)');
      console.log('- participant3@example.com (password: password123)');
    }

    console.log('\n📝 Next Steps:');
    console.log('1. Continue with frontend implementation');
    console.log('2. Test participant sign-up flow at http://localhost:3000/auth/sign-up');
    console.log('3. Enable registration for events in admin panel');
    console.log('4. Test team creation and joining functionality\n');

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
  console.log('The automated migration failed. Follow these steps:');
  console.log('');
  console.log('1. Open your Supabase Dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Copy and paste the contents of:');
  console.log(`   ${filepath}`);
  console.log('4. Click "Run" to execute the SQL');
  console.log('5. Or re-run: npm run db:participant-setup');
  console.log('');
}

// Run the setup
setupParticipantFeature().catch(console.error);