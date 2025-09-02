import { db } from '../lib/db'
import { sql } from 'drizzle-orm'

async function checkAndMigrate() {
  console.log('Checking database state and running migration...')
  
  try {
    // Check if enums already exist
    const enumsResult = await db.execute(sql`
      SELECT typname 
      FROM pg_type 
      WHERE typname IN ('criteria_category', 'team_award_type')
    `)
    
    const existingEnums = enumsResult.map((row: any) => row.typname)
    
    // Create enums if they don't exist
    if (!existingEnums.includes('criteria_category')) {
      console.log('Creating criteria_category enum...')
      await db.execute(sql`CREATE TYPE criteria_category AS ENUM ('technical', 'business')`)
    }
    
    if (!existingEnums.includes('team_award_type')) {
      console.log('Creating team_award_type enum...')
      await db.execute(sql`CREATE TYPE team_award_type AS ENUM ('technical', 'business', 'both')`)
    }
    
    // Check if columns exist
    const columnsResult = await db.execute(sql`
      SELECT column_name, table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (
        (table_name = 'criteria' AND column_name IN ('weight', 'category'))
        OR (table_name = 'teams' AND column_name = 'award_type')
      )
    `)
    
    const existingColumns = columnsResult.map((row: any) => `${row.table_name}.${row.column_name}`)
    
    // Add columns if they don't exist
    if (!existingColumns.includes('criteria.weight')) {
      console.log('Adding weight column to criteria...')
      await db.execute(sql`ALTER TABLE criteria ADD COLUMN weight INTEGER NOT NULL DEFAULT 20`)
    }
    
    if (!existingColumns.includes('criteria.category')) {
      console.log('Adding category column to criteria...')
      await db.execute(sql`ALTER TABLE criteria ADD COLUMN category criteria_category NOT NULL DEFAULT 'technical'`)
    }
    
    if (!existingColumns.includes('teams.award_type')) {
      console.log('Adding award_type column to teams...')
      await db.execute(sql`ALTER TABLE teams ADD COLUMN award_type team_award_type NOT NULL DEFAULT 'both'`)
    }
    
    // Add constraints if they don't exist
    const constraintsResult = await db.execute(sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'criteria' 
      AND constraint_name = 'check_weight_range'
    `)
    
    if (constraintsResult.length === 0) {
      console.log('Adding weight range constraint...')
      await db.execute(sql`
        ALTER TABLE criteria
        ADD CONSTRAINT check_weight_range CHECK (weight >= 0 AND weight <= 100)
      `)
    }
    
    // Create indexes if they don't exist
    const indexesResult = await db.execute(sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('criteria', 'teams') 
      AND indexname IN ('idx_criteria_category', 'idx_teams_award_type')
    `)
    
    const existingIndexes = indexesResult.map((row: any) => row.indexname)
    
    if (!existingIndexes.includes('idx_criteria_category')) {
      console.log('Creating criteria category index...')
      await db.execute(sql`CREATE INDEX idx_criteria_category ON criteria(category)`)
    }
    
    if (!existingIndexes.includes('idx_teams_award_type')) {
      console.log('Creating teams award type index...')
      await db.execute(sql`CREATE INDEX idx_teams_award_type ON teams(award_type)`)
    }
    
    console.log('Migration check completed!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

checkAndMigrate()