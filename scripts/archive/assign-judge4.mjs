// Script to assign judge4 to active event for testing
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function assignJudge4() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Get active event and judge4 IDs
    const activeEvent = await client.query(`SELECT id, name FROM events WHERE status = 'active' LIMIT 1`);
    const judge4 = await client.query(`SELECT id, email FROM users WHERE email = 'judge4@test.com' LIMIT 1`);
    
    if (activeEvent.rows.length === 0) {
      console.log('❌ No active event found');
      return;
    }
    
    if (judge4.rows.length === 0) {
      console.log('❌ judge4@test.com not found');
      return;
    }

    // Assign judge4 to active event
    await client.query(`
      INSERT INTO event_judges (event_id, judge_id)
      VALUES ($1, $2)
      ON CONFLICT (event_id, judge_id) DO NOTHING
    `, [activeEvent.rows[0].id, judge4.rows[0].id]);
    
    console.log(`✅ Successfully assigned ${judge4.rows[0].email} to "${activeEvent.rows[0].name}"`);
    console.log('\n🧪 TEST INSTRUCTIONS:');
    console.log('1. If you are logged in as judge4@test.com, refresh the page');
    console.log('2. You should now see teams and be able to score');
    console.log('3. The 403 errors should be gone');
    
    // Verify assignment
    const verification = await client.query(`
      SELECT COUNT(*) as count FROM event_judges 
      WHERE event_id = $1 AND judge_id = $2
    `, [activeEvent.rows[0].id, judge4.rows[0].id]);
    
    console.log(`\n✅ Verification: Assignment count = ${verification.rows[0].count}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

assignJudge4();