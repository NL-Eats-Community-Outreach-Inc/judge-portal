import * as dotenv from 'dotenv'
import postgres from 'postgres'

// Load environment variables
dotenv.config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL!

const verifyData = async () => {
  console.log('🔍 Verifying database contents...')
  
  const client = postgres(connectionString, { max: 1 })
  
  try {
    // Check users
    const users = await client`SELECT id, email, role FROM users ORDER BY role, email`
    console.log(`\n👥 Users (${users.length}):`)
    users.forEach(user => console.log(`   • ${user.email} (${user.role})`))

    // Check events
    const events = await client`SELECT id, name, status FROM events ORDER BY name`
    console.log(`\n🎪 Events (${events.length}):`)
    events.forEach(event => console.log(`   • "${event.name}" - ${event.status}`))

    // Check teams
    const teams = await client`
      SELECT t.name, e.name as event_name, t.presentation_order 
      FROM teams t 
      JOIN events e ON t.event_id = e.id 
      ORDER BY e.name, t.presentation_order
    `
    console.log(`\n🏆 Teams (${teams.length}):`)
    teams.forEach(team => console.log(`   • ${team.name} (${team.event_name}) - Order: ${team.presentation_order}`))

    // Check criteria
    const criteria = await client`
      SELECT c.name, e.name as event_name, c.display_order 
      FROM criteria c 
      JOIN events e ON c.event_id = e.id 
      ORDER BY e.name, c.display_order
    `
    console.log(`\n📋 Criteria (${criteria.length}):`)
    criteria.forEach(criterion => console.log(`   • ${criterion.name} (${criterion.event_name}) - Order: ${criterion.display_order}`))

    // Check scores
    const scores = await client`
      SELECT s.score, u.email as judge_email, t.name as team_name, c.name as criterion_name
      FROM scores s
      JOIN users u ON s.judge_id = u.id
      JOIN teams t ON s.team_id = t.id
      JOIN criteria c ON s.criterion_id = c.id
      ORDER BY t.name, c.display_order
    `
    console.log(`\n⭐ Scores (${scores.length}):`)
    scores.forEach(score => console.log(`   • ${score.team_name} - ${score.criterion_name}: ${score.score}/10 (by ${score.judge_email})`))

    console.log('\n✅ Database verification complete!')

  } catch (error) {
    console.error('❌ Error verifying database:', error)
  } finally {
    await client.end()
  }
}

verifyData().catch(console.error)