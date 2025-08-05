import * as dotenv from 'dotenv'
import postgres from 'postgres'

// Load environment variables
dotenv.config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL!

console.log('🔗 Database URL:', connectionString ? 'Found' : 'Not found')

const runMigration = async () => {
  console.log('🚀 Running migration to add criteria weights and team award types...')
  
  // Create direct connection for all operations
  const client = postgres(connectionString, { max: 1 })
  
  try {
    // Check if enums already exist
    const enumsResult = await client`
      SELECT typname 
      FROM pg_type 
      WHERE typname IN ('criteria_category', 'team_award_type')
    `
    
    const existingEnums = enumsResult.map(row => row.typname)
    
    // Create enums if they don't exist
    if (!existingEnums.includes('criteria_category')) {
      console.log('Creating criteria_category enum...')
      await client`CREATE TYPE criteria_category AS ENUM ('technical', 'business')`
    }
    
    if (!existingEnums.includes('team_award_type')) {
      console.log('Creating team_award_type enum...')
      await client`CREATE TYPE team_award_type AS ENUM ('technical', 'business', 'both')`
    }
    
    // Check if columns exist
    const columnsResult = await client`
      SELECT column_name, table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (
        (table_name = 'criteria' AND column_name IN ('weight', 'category'))
        OR (table_name = 'teams' AND column_name = 'award_type')
      )
    `
    
    const existingColumns = columnsResult.map(row => `${row.table_name}.${row.column_name}`)
    
    // Add columns if they don't exist
    if (!existingColumns.includes('criteria.weight')) {
      console.log('Adding weight column to criteria...')
      await client`ALTER TABLE criteria ADD COLUMN weight INTEGER NOT NULL DEFAULT 20`
    }
    
    if (!existingColumns.includes('criteria.category')) {
      console.log('Adding category column to criteria...')
      await client`ALTER TABLE criteria ADD COLUMN category criteria_category NOT NULL DEFAULT 'technical'`
    }
    
    if (!existingColumns.includes('teams.award_type')) {
      console.log('Adding award_type column to teams...')
      await client`ALTER TABLE teams ADD COLUMN award_type team_award_type NOT NULL DEFAULT 'both'`
    }
    
    // Add constraints if they don't exist
    const constraintsResult = await client`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'criteria' 
      AND constraint_name = 'check_weight_range'
    `
    
    if (constraintsResult.length === 0) {
      console.log('Adding weight range constraint...')
      await client`
        ALTER TABLE criteria
        ADD CONSTRAINT check_weight_range CHECK (weight >= 0 AND weight <= 100)
      `
    }
    
    // Create indexes if they don't exist
    const indexesResult = await client`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('criteria', 'teams') 
      AND indexname IN ('idx_criteria_category', 'idx_teams_award_type')
    `
    
    const existingIndexes = indexesResult.map(row => row.indexname)
    
    if (!existingIndexes.includes('idx_criteria_category')) {
      console.log('Creating criteria category index...')
      await client`CREATE INDEX idx_criteria_category ON criteria(category)`
    }
    
    if (!existingIndexes.includes('idx_teams_award_type')) {
      console.log('Creating teams award type index...')
      await client`CREATE INDEX idx_teams_award_type ON teams(award_type)`
    }
    
    // Update existing criteria with proper categories and weights based on common names
    console.log('Updating existing criteria with categories and weights...')
    
    // Technical criteria
    await client`
      UPDATE criteria SET category = 'technical', weight = 25 
      WHERE LOWER(name) LIKE '%problem%' AND LOWER(name) LIKE '%innovation%'
    `
    await client`
      UPDATE criteria SET category = 'technical', weight = 20 
      WHERE LOWER(name) LIKE '%technical%' AND LOWER(name) LIKE '%implementation%'
    `
    await client`
      UPDATE criteria SET category = 'technical', weight = 30 
      WHERE LOWER(name) LIKE '%execution%' AND LOWER(name) LIKE '%progress%'
    `
    await client`
      UPDATE criteria SET category = 'technical', weight = 15 
      WHERE LOWER(name) LIKE '%potential%' AND LOWER(name) LIKE '%impact%'
    `
    await client`
      UPDATE criteria SET category = 'technical', weight = 10 
      WHERE LOWER(name) LIKE '%presentation%' AND category = 'technical'
    `
    
    // Business criteria
    await client`
      UPDATE criteria SET category = 'business', weight = 25 
      WHERE LOWER(name) LIKE '%market%' AND (LOWER(name) LIKE '%problem%' OR LOWER(name) LIKE '%opportunity%')
    `
    await client`
      UPDATE criteria SET category = 'business', weight = 25 
      WHERE LOWER(name) LIKE '%solution%' AND LOWER(name) LIKE '%competitive%'
    `
    await client`
      UPDATE criteria SET category = 'business', weight = 20 
      WHERE LOWER(name) LIKE '%business%' AND LOWER(name) LIKE '%model%'
    `
    await client`
      UPDATE criteria SET category = 'business', weight = 20 
      WHERE LOWER(name) LIKE '%team%' AND LOWER(name) LIKE '%execution%'
    `
    await client`
      UPDATE criteria SET category = 'business', weight = 10 
      WHERE LOWER(name) LIKE '%pitch%' OR (LOWER(name) LIKE '%presentation%' AND category = 'business')
    `
    
    console.log('✅ Migration completed successfully!')
    
    // Show current state
    const criteriaCount = await client`
      SELECT category, COUNT(*) as count, SUM(weight) as total_weight
      FROM criteria
      GROUP BY category
    `
    console.log('📊 Criteria summary:', criteriaCount)
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()