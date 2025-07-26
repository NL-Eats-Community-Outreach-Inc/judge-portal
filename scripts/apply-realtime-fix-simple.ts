#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

// Database connection
const connectionString = process.env.DATABASE_URL!
const client = postgres(connectionString)
const db = drizzle(client)

async function applyRealtimeFix() {
  try {
    console.log('🔧 Applying Realtime and RLS fixes...')
    
    // Enable RLS on all tables
    console.log('Enabling RLS on tables...')
    await client`ALTER TABLE "events" ENABLE ROW LEVEL SECURITY`
    await client`ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY`
    await client`ALTER TABLE "criteria" ENABLE ROW LEVEL SECURITY`
    await client`ALTER TABLE "scores" ENABLE ROW LEVEL SECURITY`
    
    // Create judge policies
    console.log('Creating judge policies...')
    
    // Judges can view all events
    await client`
      CREATE POLICY "Judges can view all events" ON "events"
      FOR SELECT TO public
      USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'judge'::user_role
      ))
    `
    
    // Judges can view teams
    await client`
      CREATE POLICY "Judges can view teams" ON "teams"  
      FOR SELECT TO public
      USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'judge'::user_role
      ))
    `
    
    // Judges can view criteria
    await client`
      CREATE POLICY "Judges can view criteria" ON "criteria"
      FOR SELECT TO public
      USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'judge'::user_role
      ))
    `
    
    // Judges can manage their own scores
    await client`
      CREATE POLICY "Judges can manage their own scores" ON "scores"
      FOR ALL TO public
      USING (
        judge_id = auth.uid() 
        AND EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() 
          AND users.role = 'judge'::user_role
        )
      )
    `
    
    // Enable Realtime for all tables
    console.log('Enabling Realtime for tables...')
    await client`ALTER PUBLICATION supabase_realtime ADD TABLE events`
    await client`ALTER PUBLICATION supabase_realtime ADD TABLE teams`
    await client`ALTER PUBLICATION supabase_realtime ADD TABLE criteria`
    await client`ALTER PUBLICATION supabase_realtime ADD TABLE scores`
    await client`ALTER PUBLICATION supabase_realtime ADD TABLE users`
    
    console.log('🎉 Realtime and RLS fixes applied successfully!')
    
  } catch (error) {
    console.error('❌ Failed to apply fixes:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

applyRealtimeFix()