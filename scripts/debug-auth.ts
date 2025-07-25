import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function debugAuth() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  try {
    console.log('🔍 Debug: Checking auth system...')
    
    // Get all auth users with detailed info
    const { data: authResponse, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Auth error:', authError)
      return
    }
    
    console.log(`\n📊 Found ${authResponse.users.length} auth users:`)
    authResponse.users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Created: ${user.created_at}`)
      console.log(`   Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`)
      console.log(`   Last sign in: ${user.last_sign_in_at || 'Never'}`)
      console.log('')
    })
    
    // Get public users
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('*')
    
    if (publicError) {
      console.error('❌ Public users error:', publicError)
      return
    }
    
    console.log(`📊 Found ${publicUsers.length} public users:`)
    publicUsers.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   Created: ${user.created_at}`)
      console.log('')
    })
    
    // Check if bofg.fu@gmail.com exists in auth
    const bofgUser = authResponse.users.find(u => u.email === 'bofg.fu@gmail.com')
    if (bofgUser) {
      console.log('✅ Found bofg.fu@gmail.com in auth users!')
    } else {
      console.log('❌ bofg.fu@gmail.com NOT found in auth users')
      console.log('📝 This means the user might have been deleted or never existed')
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error)
  }
}

debugAuth()