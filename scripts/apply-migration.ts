import postgres from 'postgres'
import fs from 'fs'
import path from 'path'

const connectionString = process.env.DATABASE_URL!

const applyMigration = async () => {
  console.log('Applying migration directly...')
  
  const client = postgres(connectionString, { max: 1 })
  
  try {
    // Read the migration SQL
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/0002_lively_epoch.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Split by statement breakpoint and execute each statement
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 100) + '...')
      await client.unsafe(statement)
    }
    
    console.log('Migration applied successfully!')
  } catch (error) {
    console.error('Error applying migration:', error)
  } finally {
    await client.end()
  }
}

applyMigration()