import { db } from '../lib/db'
import { sql } from 'drizzle-orm'

async function runMigration() {
  console.log('Running migration to add criteria weights and team award types...')
  
  try {
    // Create enums
    await db.execute(sql`CREATE TYPE criteria_category AS ENUM ('technical', 'business')`)
    await db.execute(sql`CREATE TYPE team_award_type AS ENUM ('technical', 'business', 'both')`)
    
    // Add columns to criteria table
    await db.execute(sql`
      ALTER TABLE criteria 
      ADD COLUMN weight INTEGER NOT NULL DEFAULT 20,
      ADD COLUMN category criteria_category NOT NULL DEFAULT 'technical'
    `)
    
    // Add weight constraint
    await db.execute(sql`
      ALTER TABLE criteria
      ADD CONSTRAINT check_weight_range CHECK (weight >= 0 AND weight <= 100)
    `)
    
    // Add award_type to teams table
    await db.execute(sql`
      ALTER TABLE teams
      ADD COLUMN award_type team_award_type NOT NULL DEFAULT 'both'
    `)
    
    // Update existing criteria categories based on names
    await db.execute(sql`
      UPDATE criteria SET category = 'technical' 
      WHERE name IN ('Innovation', 'Technical Implementation', 'Presentation', 'Feasibility', 'Impact')
    `)
    
    await db.execute(sql`
      UPDATE criteria SET category = 'business' 
      WHERE name IN ('Market Opportunity', 'Business Model', 'Team', 'Scalability', 'Pitch Quality')
    `)
    
    // Create indexes
    await db.execute(sql`CREATE INDEX idx_criteria_category ON criteria(category)`)
    await db.execute(sql`CREATE INDEX idx_teams_award_type ON teams(award_type)`)
    
    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigration()