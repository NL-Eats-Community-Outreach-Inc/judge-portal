// Script to test the event_judges assignment data
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testAssignmentData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Test 1: Check event_judges table exists and has data
    console.log('1. Testing event_judges table:');
    const assignments = await client.query(`
      SELECT e.name as event_name, u.email as judge_email, ej.assigned_at
      FROM event_judges ej
      JOIN events e ON e.id = ej.event_id
      JOIN users u ON u.id = ej.judge_id
      ORDER BY e.name, u.email
    `);
    
    console.log(`   Found ${assignments.rows.length} judge assignments:`);
    assignments.rows.forEach(row => {
      console.log(`   - ${row.event_name}: ${row.judge_email}`);
    });

    // Test 2: Check that scores still exist and are properly linked
    console.log('\n2. Testing score preservation:');
    const scoreCount = await client.query(`
      SELECT COUNT(*) as count FROM scores
    `);
    console.log(`   Total scores in database: ${scoreCount.rows[0].count}`);

    // Test 3: Test a sample API call simulation (assigned judge should work)
    console.log('\n3. Testing assignment validation logic:');
    const sampleTest = await client.query(`
      SELECT 
        u.email as judge_email,
        e.name as event_name,
        CASE 
          WHEN ej.judge_id IS NOT NULL THEN 'ASSIGNED'
          ELSE 'NOT ASSIGNED'
        END as assignment_status
      FROM events e
      CROSS JOIN users u
      LEFT JOIN event_judges ej ON ej.event_id = e.id AND ej.judge_id = u.id
      WHERE e.status = 'active' AND u.role = 'judge'
      ORDER BY u.email, e.name
    `);
    
    console.log(`   Assignment status for active event judges:`);
    sampleTest.rows.forEach(row => {
      console.log(`   - ${row.judge_email} → ${row.event_name}: ${row.assignment_status}`);
    });

    // Test 4: Verify all existing judges are assigned to all events (backward compatibility)
    console.log('\n4. Testing backward compatibility:');
    const compatibilityTest = await client.query(`
      SELECT 
        COUNT(DISTINCT u.id) as total_judges,
        COUNT(DISTINCT e.id) as total_events,
        COUNT(*) as expected_assignments,
        (SELECT COUNT(*) FROM event_judges) as actual_assignments
      FROM users u 
      CROSS JOIN events e 
      WHERE u.role = 'judge'
    `);
    
    const result = compatibilityTest.rows[0];
    console.log(`   Total judges: ${result.total_judges}`);
    console.log(`   Total events: ${result.total_events}`);
    console.log(`   Expected assignments: ${result.expected_assignments}`);
    console.log(`   Actual assignments: ${result.actual_assignments}`);
    console.log(`   Backward compatibility: ${result.expected_assignments === result.actual_assignments ? '✅ PASSED' : '❌ FAILED'}`);
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

testAssignmentData();