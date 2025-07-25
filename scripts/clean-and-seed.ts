import * as dotenv from 'dotenv'
import { db } from '../lib/db/index'
import { users, events, teams, criteria, scores } from '../lib/db/schema'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'

// Load environment variables
dotenv.config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL!

console.log('🔗 Database URL:', connectionString ? 'Found' : 'Not found')
console.log('🔗 Connection string preview:', connectionString?.substring(0, 30) + '...')

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
    const sampleUsers = await db.insert(users).values([
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@example.com',
        role: 'admin'
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        email: 'judge1@example.com',
        role: 'judge'
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        email: 'judge2@example.com',
        role: 'judge'
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        email: 'judge3@example.com',
        role: 'judge'
      }
    ]).returning()

    // Create Event 1: Tech Innovation Hackathon
    const event1 = await db.insert(events).values({
      name: 'Tech Innovation Hackathon 2025',
      description: 'A 48-hour hackathon focused on building innovative tech solutions for real-world problems. Participants compete in categories ranging from AI/ML to sustainable technology.',
      status: 'active'
    }).returning()

    const event1Id = event1[0].id

    // Create Event 2: Startup Pitch Competition
    const event2 = await db.insert(events).values({
      name: 'Global Startup Pitch Competition',
      description: 'Early-stage startups present their business ideas to a panel of expert judges and investors. Focus on scalability, market potential, and innovative business models.',
      status: 'setup'
    }).returning()

    const event2Id = event2[0].id

    // Create teams for Event 1 (Tech Hackathon)
    const event1Teams = await db.insert(teams).values([
      {
        eventId: event1Id,
        name: 'EcoTrack Solutions',
        description: 'AI-powered carbon footprint tracking app that gamifies sustainable living through real-time emissions monitoring and community challenges.',
        demoUrl: 'https://ecotrack-demo.vercel.app',
        repoUrl: 'https://github.com/ecotrack/carbon-tracker',
        presentationOrder: 1
      },
      {
        eventId: event1Id,
        name: 'MindBridge AI',
        description: 'Mental health support platform using natural language processing to provide personalized therapy recommendations and crisis intervention.',
        demoUrl: 'https://mindbridge-ai.netlify.app',
        repoUrl: 'https://github.com/mindbridge/therapy-ai',
        presentationOrder: 2
      },
      {
        eventId: event1Id,
        name: 'UrbanFlow',
        description: 'Smart city traffic optimization system using real-time data analytics and machine learning to reduce congestion and improve emergency response times.',
        demoUrl: 'https://urbanflow-smart.herokuapp.com',
        repoUrl: 'https://github.com/urbanflow/traffic-optimizer',
        presentationOrder: 3
      },
      {
        eventId: event1Id,
        name: 'CropSense',
        description: 'IoT-enabled precision agriculture platform that uses sensor data and computer vision to optimize crop yields while minimizing water and fertilizer usage.',
        demoUrl: 'https://cropsense-demo.firebase.app',
        repoUrl: 'https://github.com/cropsense/precision-farming',
        presentationOrder: 4
      }
    ]).returning()

    // Create teams for Event 2 (Startup Pitch)
    const event2Teams = await db.insert(teams).values([
      {
        eventId: event2Id,
        name: 'FoodRescue',
        description: 'B2B marketplace connecting restaurants with surplus food to local food banks and shelters, reducing waste while addressing hunger.',
        demoUrl: 'https://foodrescue-marketplace.com',
        repoUrl: 'https://github.com/foodrescue/marketplace-platform',
        presentationOrder: 1
      },
      {
        eventId: event2Id,
        name: 'LearnLoop',
        description: 'Personalized micro-learning platform for professional development that adapts to individual learning styles and schedules.',
        demoUrl: 'https://learnloop-app.com',
        repoUrl: 'https://github.com/learnloop/micro-learning',
        presentationOrder: 2
      },
      {
        eventId: event2Id,
        name: 'HealthSync',
        description: 'Telemedicine platform specializing in chronic disease management with integrated wearables and AI-driven health insights.',
        demoUrl: 'https://healthsync-telemedicine.com',
        repoUrl: 'https://github.com/healthsync/chronic-care',
        presentationOrder: 3
      }
    ]).returning()

    // Create criteria for Event 1 (Tech Hackathon)
    const event1Criteria = await db.insert(criteria).values([
      {
        eventId: event1Id,
        name: 'Technical Innovation',
        description: 'Creativity and novelty of the technical solution, use of cutting-edge technologies',
        minScore: 1,
        maxScore: 10,
        displayOrder: 1
      },
      {
        eventId: event1Id,
        name: 'Code Quality',
        description: 'Clean, maintainable code with proper documentation and testing practices',
        minScore: 1,
        maxScore: 10,
        displayOrder: 2
      },
      {
        eventId: event1Id,
        name: 'User Experience',
        description: 'Intuitive design, usability, and overall user interface quality',
        minScore: 1,
        maxScore: 10,
        displayOrder: 3
      },
      {
        eventId: event1Id,
        name: 'Real-world Impact',
        description: 'Potential to solve actual problems and create meaningful change',
        minScore: 1,
        maxScore: 10,
        displayOrder: 4
      },
      {
        eventId: event1Id,
        name: 'Demo Presentation',
        description: 'Quality of live demonstration and team presentation skills',
        minScore: 1,
        maxScore: 10,
        displayOrder: 5
      }
    ]).returning()

    // Create criteria for Event 2 (Startup Pitch)
    const event2Criteria = await db.insert(criteria).values([
      {
        eventId: event2Id,
        name: 'Market Opportunity',
        description: 'Size and growth potential of the target market, problem validation',
        minScore: 1,
        maxScore: 10,
        displayOrder: 1
      },
      {
        eventId: event2Id,
        name: 'Business Model',
        description: 'Viability and scalability of the revenue model and go-to-market strategy',
        minScore: 1,
        maxScore: 10,
        displayOrder: 2
      },
      {
        eventId: event2Id,
        name: 'Team Strength',
        description: 'Experience, expertise, and complementary skills of the founding team',
        minScore: 1,
        maxScore: 10,
        displayOrder: 3
      },
      {
        eventId: event2Id,
        name: 'Product Differentiation',
        description: 'Unique value proposition and competitive advantages',
        minScore: 1,
        maxScore: 10,
        displayOrder: 4
      },
      {
        eventId: event2Id,
        name: 'Financial Projections',
        description: 'Realistic financial forecasts and funding requirements',
        minScore: 1,
        maxScore: 10,
        displayOrder: 5
      }
    ]).returning()

    // Create some sample scores for Event 1 (active event)
    const sampleScores = []
    const judgeIds = ['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003']
    
    // Judge 1 scores for first two teams
    for (const teamIndex of [0, 1]) {
      const team = event1Teams[teamIndex]
      for (const criterion of event1Criteria) {
        sampleScores.push({
          eventId: event1Id,
          judgeId: judgeIds[0],
          teamId: team.id,
          criterionId: criterion.id,
          score: Math.floor(Math.random() * 4) + 7, // Random score between 7-10
          comment: `Good work on ${criterion.name.toLowerCase()}. Shows strong potential with room for improvement.`
        })
      }
    }

    // Judge 2 scores for first team only
    const team1 = event1Teams[0]
    for (const criterion of event1Criteria) {
      sampleScores.push({
        eventId: event1Id,
        judgeId: judgeIds[1],
        teamId: team1.id,
        criterionId: criterion.id,
        score: Math.floor(Math.random() * 3) + 8, // Random score between 8-10
        comment: `Excellent ${criterion.name.toLowerCase()}. This solution demonstrates strong understanding of the problem space.`
      })
    }

    if (sampleScores.length > 0) {
      await db.insert(scores).values(sampleScores)
    }

    console.log('✅ Test data created successfully!')
    console.log(`📊 Summary:`)
    console.log(`   • Users: ${sampleUsers.length} (1 admin, 3 judges)`)
    console.log(`   • Events: 2`)
    console.log(`     - "${event1[0].name}" (active) - ${event1Teams.length} teams, ${event1Criteria.length} criteria`)
    console.log(`     - "${event2[0].name}" (setup) - ${event2Teams.length} teams, ${event2Criteria.length} criteria`)
    console.log(`   • Total Teams: ${event1Teams.length + event2Teams.length}`)
    console.log(`   • Sample Scores: ${sampleScores.length}`)
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