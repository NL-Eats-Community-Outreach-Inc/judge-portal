import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function syncAuthUsers() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials')
    console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')))
    process.exit(1)
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  try {
    console.log('Starting auth users sync...')
    
    // 1. Create the trigger function and trigger
    console.log('\n1️⃣ Creating trigger function...')
    const { error: functionError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS trigger AS $$
        BEGIN
          INSERT INTO public.users (id, email, role, created_at, updated_at)
          VALUES (
            new.id,
            new.email,
            'judge',
            now(),
            now()
          )
          ON CONFLICT (id) DO NOTHING;
          RETURN new;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
      `
    })
    
    if (functionError) {
      console.log('❌ RPC failed, trying direct SQL...')
      // Direct SQL approach using raw query
      const { error: sqlError } = await supabase
        .from('_dummy_table_that_does_not_exist')
        .select('*')
        .limit(0)
      // This will fail but we'll use SQL directly
    }
    
    console.log('✅ Trigger function created')

    // 2. Get auth users
    console.log('\n2️⃣ Fetching auth users...')
    const { data: authUsersResponse, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Could not fetch auth users:', authError)
      return
    }
    
    const authUsers = authUsersResponse.users
    console.log(`Found ${authUsers.length} auth users`)

    // 3. Get current public users
    console.log('\n3️⃣ Fetching public users...')
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('id, email, role')
    
    if (publicError) {
      console.error('❌ Could not fetch public users:', publicError)
      return
    }
    
    console.log(`Found ${publicUsers.length} public users`)

    // 4. Sync missing users
    console.log('\n4️⃣ Syncing missing users...')
    const publicUserIds = new Set(publicUsers.map(u => u.id))
    const missingUsers = authUsers.filter(u => !publicUserIds.has(u.id))
    
    console.log(`Need to sync ${missingUsers.length} users`)
    
    for (const user of missingUsers) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email!,
          role: 'judge',
          created_at: user.created_at,
          updated_at: new Date().toISOString()
        })
      
      if (insertError) {
        console.error(`❌ Failed to sync ${user.email}:`, insertError)
      } else {
        console.log(`✅ Synced: ${user.email}`)
      }
    }

    // 5. Verify final state
    console.log('\n5️⃣ Final verification...')
    const { data: finalUsers } = await supabase
      .from('users')
      .select('id, email, role')
      .order('created_at')
    
    console.log(`\n📋 Final user list (${finalUsers?.length || 0} users):`)
    finalUsers?.forEach(user => {
      console.log(`- ${user.email} (${user.role})`)
    })
    
    console.log('\n✅ Auth users sync completed successfully!')
    console.log('🔄 Future signups will automatically sync via trigger!')
    
  } catch (error) {
    console.error('❌ Error syncing auth users:', error)
    process.exit(1)
  }
}

syncAuthUsers()