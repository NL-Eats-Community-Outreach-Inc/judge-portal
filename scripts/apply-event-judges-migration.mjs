// Script to apply the event_judges migration
import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function applyMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '0008_add_event_judges_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying migration...');
    
    // Execute the entire migration as one statement
    await client.query(migrationSQL);
    
    console.log('Migration applied successfully!');
    
    // Verify the table was created
    const result = await client.query(`
      SELECT COUNT(*) as count 
      FROM event_judges
    `);
    
    console.log(`Table event_judges created with ${result.rows[0].count} rows`);
    
    // Show current assignments
    const assignments = await client.query(`
      SELECT e.name as event_name, u.email as judge_email
      FROM event_judges ej
      JOIN events e ON e.id = ej.event_id
      JOIN users u ON u.id = ej.judge_id
      ORDER BY e.name, u.email
    `);
    
    console.log('\nCurrent judge assignments:');
    assignments.rows.forEach(row => {
      console.log(`  - ${row.event_name}: ${row.judge_email}`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

applyMigration();