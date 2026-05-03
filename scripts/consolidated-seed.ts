#!/usr/bin/env tsx

/**
 * Database Seeding Script for JudgePortal
 * 
 * This script seeds the database with test data for development
 * Creates a complete test environment with:
 * - Sample event with weighted criteria
 * - Teams with different award types
 * - Test judge accounts
 * - Sample scores and comments
 * - sample submissions and AI scoring
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, inArray } from 'drizzle-orm';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import * as schema from '../lib/db/schema';

// Load environment variables
config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL || 
  `postgresql://postgres:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:54322/postgres`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables!');
  process.exit(1);
}

// Create connections
const sql = postgres(DATABASE_URL);
const db = drizzle(sql, { schema });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function seed() {
  console.log('🌱 Starting database seed...\n');
  
  try {
    // Step 1: Create test users
    console.log('👤 Creating test users...');
    
    const testUsers = [
      { email: 'admin@example.com', password: 'admin123', role: 'admin' },
      { email: 'judge1@example.com', password: 'judge123', role: 'judge' },
      { email: 'judge2@example.com', password: 'judge123', role: 'judge' },
      { email: 'judge3@example.com', password: 'judge123', role: 'judge' },
    ];
    
    const createdUsers = [];
    
    for (const user of testUsers) {
      // Create auth user
      const { data: authUser, error } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
      });
      
      if (error) {
        console.log(`  ⚠️  User ${user.email} already exists or error:`, error.message);
        // Try to get existing user
        const { data: existingUsers } = await supabase
          .from('users')
          .select('*')
          .eq('email', user.email)
          .single();
        
        if (existingUsers) {
          createdUsers.push(existingUsers);
        }
      } else if (authUser.user) {
        // Update role if admin
        if (user.role === 'admin') {
          await supabase
            .from('users')
            .update({ role: 'admin' })
            .eq('id', authUser.user.id);
        }
        
        createdUsers.push({
          id: authUser.user.id,
          email: user.email,
          role: user.role as 'admin' | 'judge',
        });
        
        console.log(`  ✅ Created ${user.role}: ${user.email}`);
      }
    }
    
    const judgeUsers = createdUsers.filter(u => u.role === 'judge');

    // Step 2: Create organization
    console.log('\n🏢 Creating organization...');

    let organization = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'NL Eats'),
    });

    if (!organization) {
      [organization] = await db
        .insert(schema.organizations)
        .values({
          name: 'NL Eats',
          slug: 'nl-eats',
          description: 'Empowering the leaders\nshaping our Food-Systems\nFuture',
        })
        .returning();
    }

    console.log(`  ✅ Organization ready: ${organization.name}`);
    
    // Step 3: Create events with competitions
    console.log('\n📅 Creating events and competitions...');

    const eventsData = [
      {
        event: {
          name: 'AgriTech Innovation Challenge 2025',
          description: 'A competition for teams building technology solutions to modernize agriculture — from precision farming and IoT sensors to supply chain and crop management platforms.',
          status: 'open' as const,
        },
        competition: {
          title: 'AgriTech Innovation Challenge',
          shortDescription: 'Modernize agriculture with precision farming, IoT, and smart crop management solutions.',
          challengeType: 'global',
          tags: ['agri-tech', 'precision-farming', 'IoT', 'crop-management'],
          prize: '$60,000 in grants and accelerator access',
          country: 'USA',
        },
      },
      {
        event: {
          name: 'Future Food Systems Hackathon 2025',
          description: 'Design and prototype next-generation food systems that are resilient, equitable, and sustainable — tackling everything from urban farming to waste reduction.',
          status: 'open' as const,
        },
        competition: {
          title: 'Future Food Systems Challenge',
          shortDescription: 'Reimagine food systems for a resilient, equitable, and sustainable future.',
          challengeType: 'global',
          tags: ['food-systems', 'urban-farming', 'sustainability', 'waste-reduction'],
          prize: '$45,000 + pilot program partnerships',
          country: 'USA',
        },
      },
      {
        event: {
          name: 'AI for Agriculture Summit 2025',
          description: 'Harness machine learning, computer vision, and data analytics to solve critical agricultural challenges — from pest detection and yield prediction to climate-adaptive farming.',
          status: 'active' as const,
        },
        competition: {
          title: 'AI for Agriculture Challenge',
          shortDescription: 'Apply AI and ML to boost farm productivity, pest control, and climate resilience.',
          challengeType: 'global',
          tags: ['AI', 'machine-learning', 'yield-prediction', 'pest-detection', 'agri-tech'],
          prize: '$80,000 + research collaboration opportunities',
          country: 'USA',
        },
      },
      {
        event: {
          name: 'Global Food Security Hackathon 2025',
          description: 'Address the world\'s most pressing food security challenges through technology — improving access, reducing hunger, strengthening supply chains, and supporting smallholder farmers.',
          status: 'open' as const,
        },
        competition: {
          title: 'Food Security Innovation Challenge',
          shortDescription: 'Build solutions that improve food access, reduce hunger, and support smallholder farmers globally.',
          challengeType: 'global',
          tags: ['food-security', 'hunger', 'smallholder-farmers', 'supply-chain', 'global-impact'],
          prize: '$100,000 in impact funding',
          country: 'USA',
        },
      },
      {
        event: {
          name: 'Smart Irrigation & Water Management Summit 2025',
          description: 'Accelerating adoption of smart water technologies in agriculture — sensor-driven irrigation, drought resilience tools, and water-efficient crop systems for a water-scarce future.',
          status: 'active' as const,
        },
        competition: {
          title: 'Smart Water for Agriculture Challenge',
          shortDescription: 'Develop sensor-driven and AI-powered water management solutions for sustainable farming.',
          challengeType: 'global',
          tags: ['smart-irrigation', 'water-management', 'drought-resilience', 'agri-tech', 'sustainability'],
          prize: '$55,000 + field pilot opportunities',
          country: 'USA',
        },
      },
      {
        event: {
          name: 'AgriData Analytics Bootcamp 2024',
          description: 'An intensive competition focused on harnessing farm data, remote sensing, and predictive analytics to improve crop yields and reduce agricultural waste. Now concluded.',
          status: 'completed' as const,
        },
        competition: {
          title: 'Farm Data & Predictive Analytics Challenge',
          shortDescription: 'Use remote sensing, satellite data, and predictive models to optimize farm productivity.',
          challengeType: 'global',
          tags: ['agri-data', 'remote-sensing', 'predictive-analytics', 'crop-yields', 'data-science'],
          prize: '$40,000 in research grants',
          country: 'USA',
        },
      },
    ];

    const createdEvents = [];

    // Keep CI runs deterministic by removing prior seeded events for this org.
    // Cascading deletes remove dependent rows like competitions and teams.
    await db
      .delete(schema.events)
      .where(
        and(
          eq(schema.events.organizationId, organization.id),
          inArray(
            schema.events.name,
            eventsData.map((item) => item.event.name)
          )
        )
      );

    for (const eventData of eventsData) {
      const [createdEvent] = await db
        .insert(schema.events)
        .values({
          ...eventData.event,
          organizationId: organization.id,
        })
        .returning();

      const competitionValues = {
        eventId: createdEvent.id,
        title: eventData.competition.title,
        shortDescription: eventData.competition.shortDescription,
        challengeType: eventData.competition.challengeType,
        tags: eventData.competition.tags,
        prize: eventData.competition.prize,
        country: eventData.competition.country,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        // Keep null so API can derive environment-specific URL via fallback.
        participantSignupUrl: null,
      };

      await db
        .insert(schema.competitions)
        .values(competitionValues)
        .onConflictDoUpdate({
          target: schema.competitions.eventId,
          set: competitionValues,
        });

      createdEvents.push(createdEvent);
      console.log(`  ✅ Created event + competition: ${createdEvent.name}`);
    }

    // Step 3–6: Criteria, teams, judges, and scores for every event
    console.log('\n📊 Creating criteria, teams, judges, and scores for all events...');

    type AwardType = 'technical' | 'business' | 'both';
    type TeamSeed = { name: string; description: string; awardType: AwardType; presentationOrder: number };

    const eventTeamsData: TeamSeed[][] = [
      // Event 0 — AgriTech Innovation Challenge
      [
        { name: 'FarmBot Collective', description: 'Autonomous robotics for precision planting and harvesting', awardType: 'technical', presentationOrder: 1 },
        { name: 'CropSense AI', description: 'AI-powered crop health monitoring using drone imagery', awardType: 'both', presentationOrder: 2 },
        { name: 'AgriChain', description: 'Blockchain-based supply chain traceability for fresh produce', awardType: 'business', presentationOrder: 3 },
        { name: 'HarvestPlus', description: 'Yield optimization platform using soil and weather data', awardType: 'both', presentationOrder: 4 },
        { name: 'SoilTech Labs', description: 'Real-time soil health diagnostics with IoT sensors', awardType: 'technical', presentationOrder: 5 },
        { name: 'FieldOps Pro', description: 'Farm operations management and workforce coordination app', awardType: 'business', presentationOrder: 6 },
      ],
      // Event 1 — Future Food Systems Hackathon
      [
        { name: 'Urban Harvest', description: 'Vertical farming systems for high-density city food production', awardType: 'both', presentationOrder: 1 },
        { name: 'FoodLoop', description: 'Circular food economy platform reducing post-harvest waste', awardType: 'business', presentationOrder: 2 },
        { name: 'NutriGrid', description: 'Equitable nutrition distribution network for underserved communities', awardType: 'business', presentationOrder: 3 },
        { name: 'PolyFarm Co', description: 'Polyculture design tools for resilient mixed cropping systems', awardType: 'technical', presentationOrder: 4 },
        { name: 'WasteNot Foods', description: 'AI-driven food surplus redistribution and shelf-life extension', awardType: 'both', presentationOrder: 5 },
        { name: 'OpenFarm Alliance', description: 'Open-source cooperative farming data platform', awardType: 'technical', presentationOrder: 6 },
      ],
      // Event 2 — AI for Agriculture Summit
      [
        { name: 'CropMind AI', description: 'Deep learning models for multi-crop disease and pest identification', awardType: 'technical', presentationOrder: 1 },
        { name: 'PestVision', description: 'Computer vision pest detection using affordable edge cameras', awardType: 'both', presentationOrder: 2 },
        { name: 'YieldPredict', description: 'ML-based seasonal yield forecasting for smallholder farmers', awardType: 'both', presentationOrder: 3 },
        { name: 'ClimateAgri', description: 'Climate-adaptive planting schedules powered by predictive AI', awardType: 'business', presentationOrder: 4 },
        { name: 'RootDeep ML', description: 'Underground root health analysis using ML-processed sensor data', awardType: 'technical', presentationOrder: 5 },
        { name: 'AgriLens', description: 'Satellite imagery analysis platform for regional crop monitoring', awardType: 'both', presentationOrder: 6 },
      ],
      // Event 3 — Global Food Security Hackathon
      [
        { name: 'NourishNet', description: 'Last-mile food delivery network connecting surplus to food-insecure regions', awardType: 'business', presentationOrder: 1 },
        { name: 'GrainPath', description: 'Transparent grain storage and logistics platform for smallholder cooperatives', awardType: 'both', presentationOrder: 2 },
        { name: 'HungerBridge', description: 'Real-time hunger mapping and emergency food response coordination tool', awardType: 'business', presentationOrder: 3 },
        { name: 'FoodReach', description: 'Mobile-first market access platform for rural smallholder farmers', awardType: 'both', presentationOrder: 4 },
        { name: 'SeedBank Pro', description: 'Community-owned digital seed exchange and crop diversity registry', awardType: 'technical', presentationOrder: 5 },
        { name: 'FarmAid Tech', description: 'Subsidized input financing and micro-credit platform for smallholders', awardType: 'business', presentationOrder: 6 },
      ],
      // Event 4 — Smart Irrigation & Water Management Summit
      [
        { name: 'AquaFarm', description: 'Automated drip irrigation scheduling based on real-time soil moisture data', awardType: 'technical', presentationOrder: 1 },
        { name: 'Dripsense', description: 'Low-cost wireless irrigation sensor network for smallholder plots', awardType: 'both', presentationOrder: 2 },
        { name: 'RainLogic', description: 'Rainfall prediction and rainwater harvesting optimization platform', awardType: 'both', presentationOrder: 3 },
        { name: 'HydroField', description: 'Hydroponic water recycling systems for water-scarce environments', awardType: 'technical', presentationOrder: 4 },
        { name: 'WaterWise AG', description: 'Farm-level water accounting and efficiency benchmarking tool', awardType: 'business', presentationOrder: 5 },
        { name: 'IrriTech', description: 'Solar-powered smart pump and irrigation management system', awardType: 'both', presentationOrder: 6 },
      ],
      // Event 5 — AgriData Analytics Bootcamp
      [
        { name: 'DataHarvest', description: 'Unified farm data ingestion pipeline for multi-source sensor integration', awardType: 'technical', presentationOrder: 1 },
        { name: 'FieldMetrics', description: 'Interactive agronomic dashboard with KPI tracking for farm managers', awardType: 'business', presentationOrder: 2 },
        { name: 'CropAnalytica', description: 'Statistical crop performance analysis and benchmarking suite', awardType: 'both', presentationOrder: 3 },
        { name: 'SatFarm AI', description: 'Satellite-derived vegetation index analysis for regional yield estimation', awardType: 'technical', presentationOrder: 4 },
        { name: 'AgriInsights', description: 'Natural language reporting tool that turns farm data into actionable insights', awardType: 'both', presentationOrder: 5 },
        { name: 'TerraScan', description: 'Ground-truth validation platform for remote sensing accuracy improvement', awardType: 'technical', presentationOrder: 6 },
      ],
    ];

    const criteriaData = [
      { name: 'Technical Implementation', description: 'Quality of code, architecture, and technical execution', weight: 35, category: 'technical' as const, displayOrder: 1 },
      { name: 'Innovation & Creativity', description: 'Uniqueness and creative approach to problem solving', weight: 30, category: 'technical' as const, displayOrder: 2 },
      { name: 'Functionality & Completeness', description: 'Working features and project completion', weight: 35, category: 'technical' as const, displayOrder: 3 },
      { name: 'Business Value', description: 'Market potential and business viability', weight: 40, category: 'business' as const, displayOrder: 4 },
      { name: 'Presentation & Pitch', description: 'Quality of presentation and communication', weight: 30, category: 'business' as const, displayOrder: 5 },
      { name: 'Scalability & Growth', description: 'Potential for scaling and future growth', weight: 30, category: 'business' as const, displayOrder: 6 },
    ];

    let totalScoreCount = 0;

    for (let i = 0; i < createdEvents.length; i++) {
      const event = createdEvents[i];

      const criteria = await db.insert(schema.criteria).values(
        criteriaData.map(c => ({ ...c, eventId: event.id, minScore: 1, maxScore: 10 }))
      ).returning();

      const teams = await db.insert(schema.teams).values(
        eventTeamsData[i].map(t => ({
          ...t,
          eventId: event.id,
          demoUrl: `https://demo-${t.name.toLowerCase().replace(/\s+/g, '-')}.example.com`,
          repoUrl: `https://github.com/agri-hack/${t.name.toLowerCase().replace(/\s+/g, '-')}`,
        }))
      ).returning();

      // Create sample submission (use first team for this event)
      const sampleSubmission = await db
        .insert(schema.submissions)
        .values({
          eventId: event.id,
          teamId: teams[0].id,
          submissionText:
            'An AI-powered freshwater collection system using atmospheric condensation and solar-powered filtration.',
        })
        .returning();

      // Create sample AI score for submission
      await db.insert(schema.submissionAiScores).values({
        submissionId: sampleSubmission[0].id,
        score: '87.5',
      });

      if (judgeUsers.length > 0) {
        await db.insert(schema.eventJudges).values(
          judgeUsers.map(judge => ({ eventId: event.id, judgeId: judge.id }))
        ).onConflictDoNothing();
      }

      for (const judge of judgeUsers.slice(0, 2)) {
        for (const team of teams.slice(0, 4)) {
          const relevantCriteria = criteria.filter(c => {
            if (team.awardType === 'both') return true;
            if (team.awardType === 'technical') return c.category === 'technical';
            if (team.awardType === 'business') return c.category === 'business';
            return false;
          });

          for (const criterion of relevantCriteria) {
            const score = Math.floor(Math.random() * 4) + 6;
            await db.insert(schema.scores).values({
              eventId: event.id,
              judgeId: judge.id,
              teamId: team.id,
              criterionId: criterion.id,
              score,
              comment: score >= 8
                ? `Excellent work on ${criterion.name}. The team showed great understanding and execution.`
                : `Good effort on ${criterion.name}. Some areas could be improved but overall solid work.`,
            }).onConflictDoNothing();
            totalScoreCount++;
          }
        }
      }

      console.log(`  ✅ Seeded criteria, teams, judges, and scores for: ${event.name}`);
    }

    console.log(`\n  ✅ Created ${totalScoreCount} total sample scores across all events`);
    
    // Done!
    console.log('\n✨ Database seeded successfully!\n');
    console.log('📋 Test Accounts:');
    console.log('  Admin: admin@example.com / admin123');
    console.log('  Judge 1: judge1@example.com / judge123');
    console.log('  Judge 2: judge2@example.com / judge123');
    console.log('  Judge 3: judge3@example.com / judge123');
    console.log('\n🏢 Organization:');
    console.log('  NL Eats - Empowering the leaders | shaping our Food-Systems | Future');
    console.log('\n� Events & Competitions:');
    console.log('  1. AgriTech Innovation Challenge 2025 (open)');
    console.log('  2. Future Food Systems Hackathon 2025 (open)');
    console.log('  3. AI for Agriculture Summit 2025 (active)');
    console.log('  4. Global Food Security Hackathon 2025 (open)');    console.log('  5. Smart Irrigation & Water Management Summit 2025 (active)');
    console.log('  6. AgriData Analytics Bootcamp 2024 (completed)');    console.log('\n📝 Notes:');
    console.log('  - All 6 events have criteria, teams, judges, and scores seeded');
    console.log('  - Judges 1 & 2 have submitted scores for teams 1-4 per event');
    console.log('  - Judge 3 has no scores (available for live testing)');
    console.log('  - Teams 5 & 6 per event have no scores yet');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the seed
seed().catch(console.error);
