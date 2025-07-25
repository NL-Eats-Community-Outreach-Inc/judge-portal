import { db } from './index'
import { events, teams, criteria } from './schema'
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL!

const seedDatabase = async () => {
  console.log('Setting up RLS policies and seeding database...')
  
  // Create direct connection for RLS policies (needs superuser permissions)
  const client = postgres(connectionString, { max: 1 })
  
  try {
    // Enable RLS on tables
    console.log('Enabling Row Level Security...')
    await client`ALTER TABLE users ENABLE ROW LEVEL SECURITY`
    await client`ALTER TABLE scores ENABLE ROW LEVEL SECURITY`
    await client`ALTER TABLE events ENABLE ROW LEVEL SECURITY`
    await client`ALTER TABLE teams ENABLE ROW LEVEL SECURITY`
    await client`ALTER TABLE criteria ENABLE ROW LEVEL SECURITY`

    // Create RLS policies for users table
    console.log('Creating user policies...')
    await client`
      CREATE POLICY "Users can view own profile" ON users 
      FOR SELECT USING (auth.uid() = id)
    `
    await client`
      CREATE POLICY "Users can update own profile" ON users 
      FOR UPDATE USING (auth.uid() = id)
    `
    await client`
      CREATE POLICY "Admins can view all users" ON users 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `

    // Create RLS policies for scores table
    console.log('Creating score policies...')
    await client`
      CREATE POLICY "Judges can view own scores" ON scores 
      FOR SELECT USING (auth.uid() = judge_id)
    `
    await client`
      CREATE POLICY "Judges can insert own scores" ON scores 
      FOR INSERT WITH CHECK (auth.uid() = judge_id)
    `
    await client`
      CREATE POLICY "Judges can update own scores" ON scores 
      FOR UPDATE USING (auth.uid() = judge_id)
    `
    await client`
      CREATE POLICY "Admins can view all scores" ON scores 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `

    // Public read policies for events, teams, criteria (all users need to see these)
    console.log('Creating public read policies...')
    await client`
      CREATE POLICY "All authenticated users can view events" ON events 
      FOR SELECT USING (auth.uid() IS NOT NULL)
    `
    await client`
      CREATE POLICY "All authenticated users can view teams" ON teams 
      FOR SELECT USING (auth.uid() IS NOT NULL)
    `
    await client`
      CREATE POLICY "All authenticated users can view criteria" ON criteria 
      FOR SELECT USING (auth.uid() IS NOT NULL)
    `

    // Admin-only policies for managing events, teams, criteria
    await client`
      CREATE POLICY "Admins can manage events" ON events 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `
    await client`
      CREATE POLICY "Admins can manage teams" ON teams 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `
    await client`
      CREATE POLICY "Admins can manage criteria" ON criteria 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `

    console.log('RLS policies created successfully!')

    // Seed initial data
    console.log('Seeding initial data...')
    
    // Create sample event
    const sampleEvent = await db.insert(events).values({
      name: 'Demo Hackathon 2025',
      description: 'A demo hackathon for testing the judging system',
      status: 'setup'
    }).returning()

    const eventId = sampleEvent[0].id

    // Create sample teams
    const sampleTeams = await db.insert(teams).values([
      {
        eventId,
        name: 'Team Alpha',
        description: 'Building the next generation AI assistant',
        demoUrl: 'https://demo.alpha.com',
        repoUrl: 'https://github.com/team-alpha/project',
        presentationOrder: 1
      },
      {
        eventId,
        name: 'Team Beta',
        description: 'Revolutionary blockchain solution for sustainability',
        demoUrl: 'https://demo.beta.com', 
        repoUrl: 'https://github.com/team-beta/project',
        presentationOrder: 2
      },
      {
        eventId,
        name: 'Team Gamma',
        description: 'Mobile app for enhancing community connections',
        demoUrl: 'https://demo.gamma.com',
        repoUrl: 'https://github.com/team-gamma/project', 
        presentationOrder: 3
      }
    ]).returning()

    // Create sample criteria
    const sampleCriteria = await db.insert(criteria).values([
      {
        eventId,
        name: 'Innovation',
        description: 'How innovative and creative is the solution?',
        minScore: 1,
        maxScore: 10,
        displayOrder: 1
      },
      {
        eventId,
        name: 'Technical Implementation',
        description: 'Quality of the technical execution and code',
        minScore: 1,
        maxScore: 10,
        displayOrder: 2
      },
      {
        eventId,
        name: 'User Experience',
        description: 'How intuitive and user-friendly is the solution?',
        minScore: 1,
        maxScore: 10,
        displayOrder: 3
      },
      {
        eventId,
        name: 'Business Viability',
        description: 'Potential for real-world application and scalability',
        minScore: 1,
        maxScore: 10,
        displayOrder: 4
      }
    ]).returning()

    console.log('Sample data created:')
    console.log(`- Event: ${sampleEvent[0].name}`)
    console.log(`- Teams: ${sampleTeams.length}`)
    console.log(`- Criteria: ${sampleCriteria.length}`)

    console.log('Database seeding completed successfully!')

  } catch (error) {
    console.error('Error seeding database:', error)
  } finally {
    await client.end()
  }
}

seedDatabase()