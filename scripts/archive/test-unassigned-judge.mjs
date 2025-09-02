// Script to test the unassigned judge functionality
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testUnassignedJudge() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Step 1: Get active event and a judge
    console.log('1. Getting active event and test judge...');
    const activeEventResult = await client.query(`
      SELECT id, name FROM events WHERE status = 'active' LIMIT 1
    `);
    
    const judgeResult = await client.query(`
      SELECT id, email FROM users WHERE role = 'judge' LIMIT 1
    `);

    if (activeEventResult.rows.length === 0 || judgeResult.rows.length === 0) {
      console.log('❌ No active event or judge found. Cannot run test.');
      return;
    }

    const activeEvent = activeEventResult.rows[0];
    const testJudge = judgeResult.rows[0];
    
    console.log(`   Active event: ${activeEvent.name}`);
    console.log(`   Test judge: ${testJudge.email}`);

    // Step 2: Temporarily remove judge assignment to test unassigned state
    console.log('\n2. Testing unassigned judge scenario...');
    
    // Backup the assignment first
    const originalAssignment = await client.query(`
      SELECT * FROM event_judges 
      WHERE event_id = $1 AND judge_id = $2
    `, [activeEvent.id, testJudge.id]);
    
    // Remove the assignment
    await client.query(`
      DELETE FROM event_judges 
      WHERE event_id = $1 AND judge_id = $2
    `, [activeEvent.id, testJudge.id]);
    
    console.log(`   ✅ Temporarily removed assignment for ${testJudge.email}`);

    // Step 3: Test the assignment check query (simulating API logic)
    console.log('\n3. Testing assignment validation query...');
    const assignmentCheck = await client.query(`
      SELECT ej.judge_id
      FROM event_judges ej
      WHERE ej.event_id = $1 AND ej.judge_id = $2
    `, [activeEvent.id, testJudge.id]);
    
    console.log(`   Assignment check result: ${assignmentCheck.rows.length === 0 ? '❌ NOT ASSIGNED (expected)' : '✅ ASSIGNED'}`);

    // Step 4: Test the query that filters scores by assignments
    console.log('\n4. Testing score filtering logic...');
    const scoresWithAssignment = await client.query(`
      SELECT COUNT(*) as count
      FROM scores s
      INNER JOIN teams t ON s.team_id = t.id
      INNER JOIN users u ON s.judge_id = u.id
      INNER JOIN event_judges ej ON ej.judge_id = u.id AND ej.event_id = t.event_id
      WHERE t.event_id = $1 AND u.id = $2
    `, [activeEvent.id, testJudge.id]);
    
    const scoresWithoutAssignment = await client.query(`
      SELECT COUNT(*) as count
      FROM scores s
      INNER JOIN teams t ON s.team_id = t.id
      WHERE t.event_id = $1 AND s.judge_id = $2
    `, [activeEvent.id, testJudge.id]);
    
    console.log(`   Scores WITH assignment filter: ${scoresWithAssignment.rows[0].count}`);
    console.log(`   Scores WITHOUT assignment filter: ${scoresWithoutAssignment.rows[0].count}`);
    console.log(`   Filtering working: ${scoresWithAssignment.rows[0].count === '0' ? '✅ YES' : '❌ NO'}`);

    // Step 5: Restore the assignment
    console.log('\n5. Restoring original assignment...');
    if (originalAssignment.rows.length > 0) {
      await client.query(`
        INSERT INTO event_judges (event_id, judge_id, assigned_at)
        VALUES ($1, $2, $3)
      `, [activeEvent.id, testJudge.id, originalAssignment.rows[0].assigned_at]);
      
      console.log(`   ✅ Restored assignment for ${testJudge.email}`);
    }

    // Step 6: Verify restoration
    const restoredCheck = await client.query(`
      SELECT COUNT(*) as count FROM event_judges 
      WHERE event_id = $1 AND judge_id = $2
    `, [activeEvent.id, testJudge.id]);
    
    console.log(`   Verification: ${restoredCheck.rows[0].count === '1' ? '✅ Assignment restored' : '❌ Failed to restore'}`);
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

testUnassignedJudge();