#!/usr/bin/env tsx

/**
 * Database Feature Update Script
 *
 * Applies feature migrations to the database.
 *
 * Usage:
 *   npm run db:update                      # Apply ALL features
 *   npm run db:update invite-link          # Apply ONE feature
 *   npm run db:update invite-link participants  # Apply MULTIPLE
 */

import { config } from 'dotenv';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL in .env.local');
  process.exit(1);
}

const FEATURES_DIR = join(process.cwd(), 'supabase', 'migrations', 'features');

// Get feature names from command line
const requestedFeatures = process.argv.slice(2);

/**
 * Get all available features (sorted by number prefix)
 */
function getAllFeatures(): string[] {
  if (!existsSync(FEATURES_DIR)) {
    console.error('❌ Features directory not found:', FEATURES_DIR);
    return [];
  }

  return readdirSync(FEATURES_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort() // Sorts by 001_, 002_, etc.
    .map((f) => f.replace('.sql', '').replace(/^\d+_/, '')); // Remove "001_" prefix
}

/**
 * Apply a single feature migration
 */
async function applyFeature(sql: ReturnType<typeof postgres>, feature: string): Promise<boolean> {
  try {
    // Find the migration file (with or without number prefix)
    const files = readdirSync(FEATURES_DIR);
    const migrationFile = files.find(
      (f) => f.endsWith(`${feature}.sql`) || f.endsWith(`_${feature}.sql`)
    );

    if (!migrationFile) {
      console.error(`  ❌ Feature migration not found: ${feature}`);
      return false;
    }

    const migrationPath = join(FEATURES_DIR, migrationFile);
    const sqlContent = readFileSync(migrationPath, 'utf-8');

    console.log(`  📝 Applying ${feature}...`);
    // One transaction per file: an error means nothing in it applied. Every
    // file is idempotent, so a failure is real and a re-run after the fix is safe.
    await sql.unsafe(sqlContent);

    console.log(`  ✅ ${feature} applied successfully`);
    return true;
  } catch (error) {
    console.error(`  ❌ ${feature} failed:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  let sql_connection: ReturnType<typeof postgres> | null = null;

  try {
    sql_connection = postgres(DATABASE_URL!);

    // Get available features
    const allFeatures = getAllFeatures();

    if (allFeatures.length === 0) {
      console.log('ℹ️  No feature migrations found.');
      console.log('Create migrations in: supabase/migrations/features/\n');
      return;
    }

    // Determine which features to apply
    let featuresToApply: string[];

    if (requestedFeatures.length === 0) {
      // No args = apply ALL features
      featuresToApply = allFeatures;

      console.log('🚀 Applying all features...\n');
      console.log(`📋 Features to apply (${featuresToApply.length}):`);
      featuresToApply.forEach((f) => console.log(`  - ${f}`));
      console.log('');
    } else {
      // Args provided = apply SPECIFIC features
      featuresToApply = requestedFeatures;

      console.log(`🚀 Applying selected features...\n`);
      console.log(`📋 Features requested (${featuresToApply.length}):`);
      featuresToApply.forEach((f) => console.log(`  - ${f}`));
      console.log('');
    }

    // Apply features in order and stop at the first failure: later files may
    // depend on the failed one
    let successCount = 0;

    for (const feature of featuresToApply) {
      const success = await applyFeature(sql_connection, feature);
      if (!success) {
        console.error(`\n❌ Stopped at ${feature}: ${successCount} feature(s) applied before it.`);
        console.error('   Fix the file and run the command again (every file is idempotent).');
        process.exit(1);
      }
      successCount++;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`✨ Feature update complete!`);
    console.log(`   Applied: ${successCount} feature(s)`);
    console.log('');
  } catch (error) {
    console.error('\n❌ Update failed:', error instanceof Error ? error.message : error);
    console.error('\n💡 Troubleshooting:');
    console.error('1. Ensure db:setup has been run first');
    console.error('2. Verify DATABASE_URL in .env.local');
    console.error('3. Check feature migration syntax');
    process.exit(1);
  } finally {
    if (sql_connection) {
      await sql_connection.end();
    }
  }
}

main();
