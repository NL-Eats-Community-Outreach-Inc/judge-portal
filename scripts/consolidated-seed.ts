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
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
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
    
    const adminUser = createdUsers.find(u => u.role === 'admin');
    const judgeUsers = createdUsers.filter(u => u.role === 'judge');
    
    // Step 2: Create sample event
    console.log('\n📅 Creating sample event...');
    
    const [event] = await db.insert(schema.events).values({
      name: 'Demo Hackathon 2025',
      description: 'A sample hackathon event for testing the JudgePortal system. This event showcases weighted scoring with technical and business criteria.',
      status: 'active',
    }).returning();
    
    console.log(`  ✅ Created event: ${event.name}`);
    
    // Step 3: Create weighted criteria
    console.log('\n📊 Creating weighted criteria...');
    
    const criteriaData = [
      // Technical criteria (should total 100%)
      { name: 'Technical Implementation', description: 'Quality of code, architecture, and technical execution', weight: 35, category: 'technical' as const, displayOrder: 1 },
      { name: 'Innovation & Creativity', description: 'Uniqueness and creative approach to problem solving', weight: 30, category: 'technical' as const, displayOrder: 2 },
      { name: 'Functionality & Completeness', description: 'Working features and project completion', weight: 35, category: 'technical' as const, displayOrder: 3 },
      
      // Business criteria (should total 100%)
      { name: 'Business Value', description: 'Market potential and business viability', weight: 40, category: 'business' as const, displayOrder: 4 },
      { name: 'Presentation & Pitch', description: 'Quality of presentation and communication', weight: 30, category: 'business' as const, displayOrder: 5 },
      { name: 'Scalability & Growth', description: 'Potential for scaling and future growth', weight: 30, category: 'business' as const, displayOrder: 6 },
    ];
    
    const criteria = await db.insert(schema.criteria).values(
      criteriaData.map(c => ({
        ...c,
        eventId: event.id,
        minScore: 1,
        maxScore: 10,
      }))
    ).returning();
    
    console.log(`  ✅ Created ${criteria.length} criteria with weights`);
    
    // Step 4: Create teams with different award types
    console.log('\n👥 Creating teams...');
    
    const teamsData = [
      { name: 'AI Innovators', description: 'Building next-gen AI solutions for healthcare', awardType: 'technical' as const, presentationOrder: 1 },
      { name: 'FinTech Revolution', description: 'Disrupting traditional banking with blockchain', awardType: 'both' as const, presentationOrder: 2 },
      { name: 'Green Energy Solutions', description: 'Sustainable energy management platform', awardType: 'business' as const, presentationOrder: 3 },
      { name: 'EduTech Masters', description: 'Personalized learning with adaptive AI', awardType: 'both' as const, presentationOrder: 4 },
      { name: 'Quantum Builders', description: 'Quantum computing accessibility tools', awardType: 'technical' as const, presentationOrder: 5 },
      { name: 'Social Impact Hub', description: 'Connecting volunteers with local causes', awardType: 'business' as const, presentationOrder: 6 },
    ];
    
    const teams = await db.insert(schema.teams).values(
      teamsData.map(t => ({
        ...t,
        eventId: event.id,
        demoUrl: `https://demo-${t.name.toLowerCase().replace(/\s+/g, '-')}.example.com`,
        repoUrl: `https://github.com/hackathon/${t.name.toLowerCase().replace(/\s+/g, '-')}`,
      }))
    ).returning();
    
    console.log(`  ✅ Created ${teams.length} teams with different award types`);
    
    // Step 5: Assign judges to event
    console.log('\n🔗 Assigning judges to event...');
    
    if (judgeUsers.length > 0) {
      await db.insert(schema.eventJudges).values(
        judgeUsers.map(judge => ({
          eventId: event.id,
          judgeId: judge.id,
        }))
      ).onConflictDoNothing();
      
      console.log(`  ✅ Assigned ${judgeUsers.length} judges to the event`);
    }
    
    // Step 6: Create sample scores
    console.log('\n📝 Creating sample scores...');
    
    let scoreCount = 0;
    
    for (const judge of judgeUsers.slice(0, 2)) { // Only first 2 judges have scores
      for (const team of teams.slice(0, 4)) { // Only first 4 teams have scores
        // Get relevant criteria based on team award type
        const relevantCriteria = criteria.filter(c => {
          if (team.awardType === 'both') return true;
          if (team.awardType === 'technical') return c.category === 'technical';
          if (team.awardType === 'business') return c.category === 'business';
          return false;
        });
        
        for (const criterion of relevantCriteria) {
          const score = Math.floor(Math.random() * 4) + 6; // Random score 6-9
          
          await db.insert(schema.scores).values({
            eventId: event.id,
            judgeId: judge.id,
            teamId: team.id,
            criterionId: criterion.id,
            score: score,
            comment: score >= 8 
              ? `Excellent work on ${criterion.name}. The team showed great understanding and execution.`
              : `Good effort on ${criterion.name}. Some areas could be improved but overall solid work.`,
          }).onConflictDoNothing();
          
          scoreCount++;
        }
      }
    }
    
    console.log(`  ✅ Created ${scoreCount} sample scores`);
    
    // Done!
    console.log('\n✨ Database seeded successfully!\n');
    console.log('📋 Test Accounts:');
    console.log('  Admin: admin@example.com / admin123');
    console.log('  Judge 1: judge1@example.com / judge123');
    console.log('  Judge 2: judge2@example.com / judge123');
    console.log('  Judge 3: judge3@example.com / judge123');
    console.log('\n📝 Notes:');
    console.log('  - Event is set to "active" status');
    console.log('  - Judges 1 & 2 have submitted scores for teams 1-4');
    console.log('  - Judge 3 has no scores yet');
    console.log('  - Teams 5 & 6 have no scores yet');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the seed
seed().catch(console.error);