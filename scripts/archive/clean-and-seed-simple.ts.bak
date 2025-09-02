import * as dotenv from 'dotenv'
import postgres from 'postgres'

// Load environment variables
dotenv.config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL!

console.log('🔗 Database URL:', connectionString ? 'Found' : 'Not found')

const cleanAndSeedDatabase = async () => {
  console.log('🧹 Cleaning and seeding database...')
  
  // Create direct connection for all operations
  const client = postgres(connectionString, { max: 1 })
  
  try {
    // Clean existing data (in proper order due to foreign key constraints)
    console.log('🗑️  Cleaning existing data...')
    await client`DELETE FROM scores`
    await client`DELETE FROM criteria`
    await client`DELETE FROM teams`
    await client`DELETE FROM events`
    await client`DELETE FROM users`
    console.log('✅ Existing data cleaned!')

    // Seed realistic test data
    console.log('🌱 Seeding test data...')
    
    // Create admin and judge users
    await client`
      INSERT INTO users (id, email, role) VALUES 
      ('00000000-0000-0000-0000-000000000001', 'admin@example.com', 'admin'),
      ('00000000-0000-0000-0000-000000000002', 'judge1@example.com', 'judge'),
      ('00000000-0000-0000-0000-000000000003', 'judge2@example.com', 'judge'),
      ('00000000-0000-0000-0000-000000000004', 'judge3@example.com', 'judge')
    `

    // Create Event 1: Tech Innovation Hackathon
    const event1Result = await client`
      INSERT INTO events (name, description, status) VALUES 
      ('Tech Innovation Hackathon 2025', 'A 48-hour hackathon focused on building innovative tech solutions for real-world problems. Participants compete in categories ranging from AI/ML to sustainable technology.', 'active')
      RETURNING id
    `
    const event1Id = event1Result[0].id

    // Create Event 2: Startup Pitch Competition
    const event2Result = await client`
      INSERT INTO events (name, description, status) VALUES 
      ('Global Startup Pitch Competition', 'Early-stage startups present their business ideas to a panel of expert judges and investors. Focus on scalability, market potential, and innovative business models.', 'setup')
      RETURNING id
    `
    const event2Id = event2Result[0].id

    // Create teams for Event 1 (Tech Hackathon)
    const event1Teams = await client`
      INSERT INTO teams (event_id, name, description, demo_url, repo_url, presentation_order) VALUES 
      (${event1Id}, 'EcoTrack Solutions', 'AI-powered carbon footprint tracking app that gamifies sustainable living through real-time emissions monitoring and community challenges.', 'https://ecotrack-demo.vercel.app', 'https://github.com/ecotrack/carbon-tracker', 1),
      (${event1Id}, 'MindBridge AI', 'Mental health support platform using natural language processing to provide personalized therapy recommendations and crisis intervention.', 'https://mindbridge-ai.netlify.app', 'https://github.com/mindbridge/therapy-ai', 2),
      (${event1Id}, 'UrbanFlow', 'Smart city traffic optimization system using real-time data analytics and machine learning to reduce congestion and improve emergency response times.', 'https://urbanflow-smart.herokuapp.com', 'https://github.com/urbanflow/traffic-optimizer', 3),
      (${event1Id}, 'CropSense', 'IoT-enabled precision agriculture platform that uses sensor data and computer vision to optimize crop yields while minimizing water and fertilizer usage.', 'https://cropsense-demo.firebase.app', 'https://github.com/cropsense/precision-farming', 4)
      RETURNING id, name
    `

    // Create teams for Event 2 (Startup Pitch)
    const event2Teams = await client`
      INSERT INTO teams (event_id, name, description, demo_url, repo_url, presentation_order) VALUES 
      (${event2Id}, 'FoodRescue', 'B2B marketplace connecting restaurants with surplus food to local food banks and shelters, reducing waste while addressing hunger.', 'https://foodrescue-marketplace.com', 'https://github.com/foodrescue/marketplace-platform', 1),
      (${event2Id}, 'LearnLoop', 'Personalized micro-learning platform for professional development that adapts to individual learning styles and schedules.', 'https://learnloop-app.com', 'https://github.com/learnloop/micro-learning', 2),
      (${event2Id}, 'HealthSync', 'Telemedicine platform specializing in chronic disease management with integrated wearables and AI-driven health insights.', 'https://healthsync-telemedicine.com', 'https://github.com/healthsync/chronic-care', 3)
      RETURNING id, name
    `

    // Create criteria for Event 1 (Tech Hackathon)
    const event1Criteria = await client`
      INSERT INTO criteria (event_id, name, description, min_score, max_score, display_order) VALUES 
      (${event1Id}, 'Technical Innovation', 'Creativity and novelty of the technical solution, use of cutting-edge technologies', 1, 10, 1),
      (${event1Id}, 'Code Quality', 'Clean, maintainable code with proper documentation and testing practices', 1, 10, 2),
      (${event1Id}, 'User Experience', 'Intuitive design, usability, and overall user interface quality', 1, 10, 3),
      (${event1Id}, 'Real-world Impact', 'Potential to solve actual problems and create meaningful change', 1, 10, 4),
      (${event1Id}, 'Demo Presentation', 'Quality of live demonstration and team presentation skills', 1, 10, 5)
      RETURNING id, name
    `

    // Create criteria for Event 2 (Startup Pitch)
    const event2Criteria = await client`
      INSERT INTO criteria (event_id, name, description, min_score, max_score, display_order) VALUES 
      (${event2Id}, 'Market Opportunity', 'Size and growth potential of the target market, problem validation', 1, 10, 1),
      (${event2Id}, 'Business Model', 'Viability and scalability of the revenue model and go-to-market strategy', 1, 10, 2),
      (${event2Id}, 'Team Strength', 'Experience, expertise, and complementary skills of the founding team', 1, 10, 3),
      (${event2Id}, 'Product Differentiation', 'Unique value proposition and competitive advantages', 1, 10, 4),
      (${event2Id}, 'Financial Projections', 'Realistic financial forecasts and funding requirements', 1, 10, 5)
      RETURNING id, name
    `

    // Create some sample scores for Event 1 (active event)
    const judgeIds = ['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003']
    
    // Judge 1 scores for first two teams (EcoTrack and MindBridge)
    for (let teamIndex = 0; teamIndex < 2; teamIndex++) {
      const team = event1Teams[teamIndex]
      for (let criterionIndex = 0; criterionIndex < event1Criteria.length; criterionIndex++) {
        const criterion = event1Criteria[criterionIndex]
        const score = Math.floor(Math.random() * 4) + 7 // Random score between 7-10
        await client`
          INSERT INTO scores (event_id, judge_id, team_id, criterion_id, score, comment) VALUES 
          (${event1Id}, ${judgeIds[0]}, ${team.id}, ${criterion.id}, ${score}, ${'Good work on ' + criterion.name.toLowerCase() + '. Shows strong potential with room for improvement.'})
        `
      }
    }

    // Judge 2 scores for first team (EcoTrack) only
    const firstTeam = event1Teams[0]
    for (const criterion of event1Criteria) {
      const score = Math.floor(Math.random() * 3) + 8 // Random score between 8-10
      await client`
        INSERT INTO scores (event_id, judge_id, team_id, criterion_id, score, comment) VALUES 
        (${event1Id}, ${judgeIds[1]}, ${firstTeam.id}, ${criterion.id}, ${score}, ${'Excellent ' + criterion.name.toLowerCase() + '. This solution demonstrates strong understanding of the problem space.'})
      `
    }

    console.log('✅ Test data created successfully!')
    console.log(`📊 Summary:`)
    console.log(`   • Users: 4 (1 admin, 3 judges)`)
    console.log(`   • Events: 2`)
    console.log(`     - "Tech Innovation Hackathon 2025" (active) - ${event1Teams.length} teams, ${event1Criteria.length} criteria`)
    console.log(`     - "Global Startup Pitch Competition" (setup) - ${event2Teams.length} teams, ${event2Criteria.length} criteria`)
    console.log(`   • Total Teams: ${event1Teams.length + event2Teams.length}`)
    console.log(`   • Sample Scores: ${(event1Criteria.length * 2) + event1Criteria.length} (partial scoring for Event 1)`)
    console.log('')
    console.log('🔑 Test Accounts:')
    console.log('   • Admin: admin@example.com')
    console.log('   • Judge 1: judge1@example.com')
    console.log('   • Judge 2: judge2@example.com')
    console.log('   • Judge 3: judge3@example.com')

  } catch (error) {
    console.error('❌ Error cleaning and seeding database:', error)
    throw error
  } finally {
    await client.end()
  }
}

// Only run if called directly
if (require.main === module) {
  cleanAndSeedDatabase().catch(console.error)
}

export { cleanAndSeedDatabase }