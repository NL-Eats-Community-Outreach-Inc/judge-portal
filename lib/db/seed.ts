import { db } from './index';
import { events, teams, criteria } from './schema';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;

const seedDatabase = async () => {
  console.log('Setting up RLS policies and seeding database...');

  // Create direct connection for RLS policies (needs superuser permissions)
  const client = postgres(connectionString, { max: 1 });

  try {
    // Enable RLS on tables
    console.log('Enabling Row Level Security...');
    await client`ALTER TABLE users ENABLE ROW LEVEL SECURITY`;
    await client`ALTER TABLE scores ENABLE ROW LEVEL SECURITY`;
    await client`ALTER TABLE events ENABLE ROW LEVEL SECURITY`;
    await client`ALTER TABLE teams ENABLE ROW LEVEL SECURITY`;
    await client`ALTER TABLE criteria ENABLE ROW LEVEL SECURITY`;

    // Create RLS policies for users table
    console.log('Creating user policies...');
    await client`
      CREATE POLICY "Users can view own profile" ON users 
      FOR SELECT USING (auth.uid() = id)
    `;
    await client`
      CREATE POLICY "Users can update own profile" ON users 
      FOR UPDATE USING (auth.uid() = id)
    `;
    await client`
      CREATE POLICY "Admins can view all users" ON users 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `;

    // Create RLS policies for scores table
    console.log('Creating score policies...');
    await client`
      CREATE POLICY "Judges can view own scores" ON scores 
      FOR SELECT USING (auth.uid() = judge_id)
    `;
    await client`
      CREATE POLICY "Judges can insert own scores" ON scores 
      FOR INSERT WITH CHECK (auth.uid() = judge_id)
    `;
    await client`
      CREATE POLICY "Judges can update own scores" ON scores 
      FOR UPDATE USING (auth.uid() = judge_id)
    `;
    await client`
      CREATE POLICY "Admins can view all scores" ON scores 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `;

    // Public read policies for events, teams, criteria (all users need to see these)
    console.log('Creating public read policies...');
    await client`
      CREATE POLICY "All authenticated users can view events" ON events 
      FOR SELECT USING (auth.uid() IS NOT NULL)
    `;
    await client`
      CREATE POLICY "All authenticated users can view teams" ON teams 
      FOR SELECT USING (auth.uid() IS NOT NULL)
    `;
    await client`
      CREATE POLICY "All authenticated users can view criteria" ON criteria 
      FOR SELECT USING (auth.uid() IS NOT NULL)
    `;

    // Admin-only policies for managing events, teams, criteria
    await client`
      CREATE POLICY "Admins can manage events" ON events 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `;
    await client`
      CREATE POLICY "Admins can manage teams" ON teams 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `;
    await client`
      CREATE POLICY "Admins can manage criteria" ON criteria 
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      )
    `;

    console.log('RLS policies created successfully!');

    // Seed initial data
    console.log('Seeding initial data...');

    // Create sample event
    const sampleEvent = await db
      .insert(events)
      .values({
        name: 'Demo Hackathon 2025',
        description: 'A demo hackathon for testing the judging system',
        status: 'setup',
      })
      .returning();

    const eventId = sampleEvent[0].id;

    // Create sample teams
    const sampleTeams = await db
      .insert(teams)
      .values([
        {
          eventId,
          name: 'Team Alpha',
          description: 'Building the next generation AI assistant',
          demoUrl: 'https://demo.alpha.com',
          repoUrl: 'https://github.com/team-alpha/project',
          presentationOrder: 1,
        },
        {
          eventId,
          name: 'Team Beta',
          description: 'Revolutionary blockchain solution for sustainability',
          demoUrl: 'https://demo.beta.com',
          repoUrl: 'https://github.com/team-beta/project',
          presentationOrder: 2,
        },
        {
          eventId,
          name: 'Team Gamma',
          description: 'Mobile app for enhancing community connections',
          demoUrl: 'https://demo.gamma.com',
          repoUrl: 'https://github.com/team-gamma/project',
          presentationOrder: 3,
        },
      ])
      .returning();

    // Create sample criteria
    const sampleCriteria = await db
      .insert(criteria)
      .values([
        {
          eventId,
          name: 'Innovation',
          description: 'How innovative and creative is the solution?',
          minScore: 1,
          maxScore: 10,
          displayOrder: 1,
          weight: 25,
          category: 'technical',
        },
        {
          eventId,
          name: 'Technical Implementation',
          description: 'Quality of the technical execution and code',
          minScore: 1,
          maxScore: 10,
          displayOrder: 2,
          weight: 50,
          category: 'technical',
        },
        {
          eventId,
          name: 'User Experience',
          description: 'How intuitive and user-friendly is the solution?',
          minScore: 1,
          maxScore: 10,
          displayOrder: 3,
          weight: 25,
          category: 'technical',
        },
        {
          eventId,
          name: 'Business Viability',
          description: 'Potential for real-world application and scalability',
          minScore: 1,
          maxScore: 10,
          displayOrder: 4,
          weight: 100,
          category: 'business',
        },
      ])
      .returning();

    console.log('Sample data created:');
    console.log(`- Event: ${sampleEvent[0].name}`);
    console.log(`- Teams: ${sampleTeams.length}`);
    console.log(`- Criteria: ${sampleCriteria.length}`);

    console.log('Seeding mentor profiles...');
    const sampleMentors = [
      {
        learnworldsUserId: 'lw_882',
        fullName: 'Sarah Jenkins',
        title: 'Senior Product Manager',
        organization: 'SEED TechFlow Systems',
        bio: 'Helping early-stage startups scale their product teams and internal processes.',
        linkedinUrl: 'https://linkedin.com',
        calendlyUrl: 'https://calendly.com',
        photoUrl: null,
        tags: ['Product Strategy', 'Agile', 'Leadership'],
        isVisible: true,
      },
      {
        learnworldsUserId: 'lw_901',
        fullName: 'Bo Li',
        title: 'Designer',
        organization: 'SEED Studio',
        bio: 'Minimalist designer focusing on mobile-first interactions.',
        linkedinUrl: 'https://linkedin.com',
        calendlyUrl: 'https://calendly.com',
        photoUrl: null,
        tags: ['UI/UX'],
        isVisible: true,
      },
      {
        learnworldsUserId: 'lw_442',
        fullName: 'Dr. Elizabeth Montgomery-Westchester III',
        title: 'Principal Software Architect and Global Head of Infrastructure Operations',
        organization: 'SEED The International Consolidated Bureau of Technological Advancements',
        bio: 'Expert in distributed systems, high-availability cloud infrastructure, and cross-continental team management.',
        linkedinUrl: 'https://linkedin.com',
        calendlyUrl: 'https://calendly.com',
        photoUrl:
          'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
        tags: [
          'Architecture',
          'K8s',
          'Cloud',
          'Scaling',
          'DevOps',
          'System Design',
          'Security',
          'Enterprise',
          'Networking',
          'Linux',
        ],
        isVisible: true,
      },
      {
        learnworldsUserId: 'lw_007',
        fullName: 'Jordan Stealth',
        title: 'Hidden Consultant',
        organization: 'SEED Incognito LLC',
        bio: 'This profile is currently set to invisible for privacy testing.',
        linkedinUrl: 'https://linkedin.com',
        calendlyUrl: 'https://calendly.com',
        photoUrl: null,
        tags: ['Internal'],
        isVisible: false,
      },
      {
        learnworldsUserId: 'lw_112',
        fullName: 'Alex Rivera',
        title: 'Junior Developer',
        organization: 'SEED Open Source Corp',
        bio: 'Passionate about React and contributing to the JavaScript ecosystem.',
        linkedinUrl: 'https://linkedin.com',
        calendlyUrl: 'https://calendly.com',
        photoUrl:
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400',
        tags: [],
        isVisible: true,
      },
      {
        learnworldsUserId: 'lw_223',
        fullName: 'Max Power',
        title: 'CEO',
        organization: 'SEED Global',
        bio: 'I build things.',
        linkedinUrl: 'https://linkedin.com',
        calendlyUrl: 'https://calendly.com',
        photoUrl:
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400',
        tags: ['Business', 'Sales'],
        isVisible: true,
      },
      {
        learnworldsUserId: 'lw_551',
        fullName: 'Sam Taggart',
        title: 'QA Engineer',
        organization: 'SEED BugSlayer Inc',
        bio: 'Specializing in end-to-end testing and automated regression suites.',
        linkedinUrl: 'https://linkedin.com',
        calendlyUrl: 'https://calendly.com',
        photoUrl:
          'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400',
        tags: ['ExtremelyLongTagNameThatMightBreakLayouts', 'Testing'],
        isVisible: true,
      },
      {
        learnworldsUserId: 'lw_334',
        fullName: 'Elena Rodriguez',
        title: 'Marketing Director',
        organization: 'SEED Growth Metrics',
        bio: 'Focusing on organic growth strategy, SEO, and brand positioning for SaaS.',
        linkedinUrl: null,
        calendlyUrl: null,
        photoUrl:
          'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&q=80&w=400',
        tags: ['Marketing', 'SEO', 'SaaS', 'Branding'],
        isVisible: true,
      },
    ];

    await db.insert(mentorProfiles).values(sampleMentors);

    console.log(`- Mentors: ${sampleMentors.length}`);

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.end();
  }
};

seedDatabase();
