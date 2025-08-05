import * as dotenv from 'dotenv'
import postgres from 'postgres'

// Load environment variables
dotenv.config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL!

const seedWithWeightedCriteria = async () => {
  console.log('🌱 Seeding database with weighted criteria from screenshots...')
  
  const client = postgres(connectionString, { max: 1 })
  
  try {
    // Clear existing criteria
    console.log('🗑️  Cleaning existing criteria...')
    await client`DELETE FROM scores`
    await client`DELETE FROM criteria`
    
    // Get the active event
    const activeEvents = await client`
      SELECT id FROM events WHERE status = 'active' LIMIT 1
    `
    
    if (activeEvents.length === 0) {
      console.log('No active event found. Creating one...')
      const newEvent = await client`
        INSERT INTO events (name, description, status) 
        VALUES ('Tech Innovation Competition 2025', 'Competition with both technical and business categories', 'active')
        RETURNING id
      `
      var eventId = newEvent[0].id
    } else {
      var eventId = activeEvents[0].id
    }
    
    console.log('📊 Creating Technical Criteria (from screenshot)...')
    
    // Technical Criteria (from screenshot)
    await client`
      INSERT INTO criteria (event_id, name, description, min_score, max_score, display_order, weight, category) VALUES 
      (${eventId}, 'Problem & Innovation', 'How well does the solution address a real problem? How innovative is the approach?', 1, 10, 1, 25, 'technical'),
      (${eventId}, 'Technical Implementation', 'Quality of code, architecture, and technical execution. Use of appropriate technologies.', 1, 10, 2, 20, 'technical'),
      (${eventId}, 'Execution & Progress', 'How much progress was made? Completeness and functionality of the solution.', 1, 10, 3, 30, 'technical'),
      (${eventId}, 'Potential for Impact', 'Scalability and real-world applicability of the solution.', 1, 10, 4, 15, 'technical'),
      (${eventId}, 'Presentation Quality', 'Clarity of presentation, demo quality, and communication skills.', 1, 10, 5, 10, 'technical')
    `
    
    console.log('💼 Creating Business Criteria (from screenshot)...')
    
    // Business Criteria (from screenshot)  
    await client`
      INSERT INTO criteria (event_id, name, description, min_score, max_score, display_order, weight, category) VALUES 
      (${eventId}, 'Market Problem & Opportunity', 'Size of market opportunity and validation of the problem being solved.', 1, 10, 6, 25, 'business'),
      (${eventId}, 'Solution & Competitive Advantage', 'Uniqueness of solution and differentiation from competitors.', 1, 10, 7, 25, 'business'),
      (${eventId}, 'Business Model & Scalability', 'Viability of revenue model and potential for scale.', 1, 10, 8, 20, 'business'),
      (${eventId}, 'Team & Execution Plan', 'Team expertise and credibility of execution plan.', 1, 10, 9, 20, 'business'),
      (${eventId}, 'The Pitch & The "Ask"', 'Quality of pitch presentation and clarity of funding/support requests.', 1, 10, 10, 10, 'business')
    `
    
    console.log('👥 Updating teams with award types...')
    
    // Update teams to have different award types
    const teams = await client`SELECT id, name FROM teams WHERE event_id = ${eventId}`
    
    if (teams.length >= 3) {
      // First team: Technical only
      await client`UPDATE teams SET award_type = 'technical' WHERE id = ${teams[0].id}`
      console.log(`   • ${teams[0].name}: Technical Awards`)
      
      // Second team: Business only  
      await client`UPDATE teams SET award_type = 'business' WHERE id = ${teams[1].id}`
      console.log(`   • ${teams[1].name}: Business Awards`)
      
      // Third team: Both categories
      await client`UPDATE teams SET award_type = 'both' WHERE id = ${teams[2].id}`
      console.log(`   • ${teams[2].name}: Both Categories`)
      
      // Remaining teams: Both categories
      for (let i = 3; i < teams.length; i++) {
        await client`UPDATE teams SET award_type = 'both' WHERE id = ${teams[i].id}`
        console.log(`   • ${teams[i].name}: Both Categories`)
      }
    }
    
    // Check weight distribution
    const weightCheck = await client`
      SELECT category, SUM(weight) as total_weight, COUNT(*) as criteria_count
      FROM criteria 
      WHERE event_id = ${eventId}
      GROUP BY category
    `
    
    console.log('✅ Weighted criteria created successfully!')
    console.log('📊 Weight Distribution:')
    weightCheck.forEach((row: any) => {
      console.log(`   • ${row.category}: ${row.total_weight}% (${row.criteria_count} criteria)`)
    })
    
    console.log('')
    console.log('🎯 Next Steps:')
    console.log('   1. Admin can manage criteria weights in the Criteria Management page')
    console.log('   2. Teams can be assigned to Technical, Business, or Both award categories')
    console.log('   3. Judges will only see relevant criteria based on team award type')
    console.log('   4. Results dashboard now shows Total, Average, and Weighted Score modes')
    
  } catch (error) {
    console.error('❌ Error seeding weighted criteria:', error)
    throw error
  } finally {
    await client.end()
  }
}

// Run the seeding
if (require.main === module) {
  seedWithWeightedCriteria().catch(console.error)
}