// Script to apply the event_judges migration
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function applyMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '0008_add_event_judges_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements (basic split by semicolon)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Applying migration with ${statements.length} statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`\nExecuting statement ${i + 1}/${statements.length}:`);
      console.log(statement.substring(0, 100) + '...');
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: statement 
      }).single();
      
      if (error) {
        // Try direct execution if RPC doesn't work
        const { data, error: directError } = await supabase
          .from('_sql')
          .insert({ query: statement })
          .select();
          
        if (directError) {
          console.error(`Error executing statement ${i + 1}:`, directError);
          // Continue with other statements
        } else {
          console.log(`Statement ${i + 1} executed successfully`);
        }
      } else {
        console.log(`Statement ${i + 1} executed successfully`);
      }
    }
    
    console.log('\nMigration completed!');
    
    // Verify the table was created
    const { data, error } = await supabase
      .from('event_judges')
      .select('count');
    
    if (error) {
      console.error('Error verifying table creation:', error);
    } else {
      console.log('Table event_judges created successfully');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();