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
    .filter(f => f.endsWith('.sql'))
    .sort() // Sorts by 001_, 002_, etc.
    .map(f => f.replace('.sql', '').replace(/^\d+_/, '')); // Remove "001_" prefix
}

/**
 * Apply a single feature migration
 */
async function applyFeature(
  sql: ReturnType<typeof postgres>,
  feature: string
): Promise<boolean> {
  try {
    // Find the migration file (with or without number prefix)
    const files = readdirSync(FEATURES_DIR);
    const migrationFile = files.find(f =>
      f.endsWith(`${feature}.sql`) ||
      f.endsWith(`_${feature}.sql`)
    );

    if (!migrationFile) {
      console.error(`  ❌ Feature migration not found: ${feature}`);
      return false;
    }

    const migrationPath = join(FEATURES_DIR, migrationFile);
    const sqlContent = readFileSync(migrationPath, 'utf-8');

    console.log(`  📝 Applying ${feature}...`);
    await sql.unsafe(sqlContent);

    console.log(`  ✅ ${feature} applied successfully`);
    return true;

  } catch (error: any) {
    // Check for safe errors (things already exist)
    const safeErrors = [
      'already exists',
      'duplicate key',
      'type .* already exists',
      'function .* already exists',
      'constraint .* already exists',
      'index .* already exists'
    ];

    const isSafe = safeErrors.some(errorPattern => {
      const regex = new RegExp(errorPattern, 'i');
      return regex.test(error.message || '');
    });

    if (isSafe) {
      console.log(`  ⚠️  ${feature} - some objects already exist (this is normal)`);
      return true;
    }

    console.error(`  ❌ ${feature} failed:`, error.message);
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
      featuresToApply.forEach(f => console.log(`  - ${f}`));
      console.log('');

    } else {
      // Args provided = apply SPECIFIC features
      featuresToApply = requestedFeatures;

      console.log(`🚀 Applying selected features...\n`);
      console.log(`📋 Features requested (${featuresToApply.length}):`);
      featuresToApply.forEach(f => console.log(`  - ${f}`));
      console.log('');
    }

    // Apply features in order
    let successCount = 0;
    let failCount = 0;

    for (const feature of featuresToApply) {
      const success = await applyFeature(sql_connection, feature);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`✨ Feature update complete!`);
    console.log(`   Applied: ${successCount} feature(s)`);
    if (failCount > 0) {
      console.log(`   Failed: ${failCount} feature(s)`);
    }
    console.log('');

    if (failCount > 0) {
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ Update failed:', error.message);
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
