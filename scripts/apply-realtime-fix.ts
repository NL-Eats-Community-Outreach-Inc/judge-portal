import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyRealtimeFix() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/0007_enable_realtime_and_rls.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('Applying Realtime and RLS fixes...')
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'))
    
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`)
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql: statement 
      }).single()
      
      if (error) {
        console.error('Error executing statement:', error)
        // Continue with other statements
      } else {
        console.log('✅ Statement executed successfully')
      }
    }
    
    console.log('🎉 Realtime and RLS fixes applied!')
    
  } catch (error) {
    console.error('Failed to apply fixes:', error)
    process.exit(1)
  }
}

applyRealtimeFix()