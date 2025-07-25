import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function fixEmailMismatch() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  try {
    console.log('🔧 Fixing email mismatch...')
    
    const userId = '2fa33caa-e284-42df-8282-3ef33e9dc9c9'
    const correctEmail = 'bofg.fu@gmail.com'
    
    // Update the public user's email to match auth user
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        email: correctEmail,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
    
    if (updateError) {
      console.error('❌ Failed to update email:', updateError)
      return
    }
    
    console.log(`✅ Updated public user email to: ${correctEmail}`)
    
    // Verify the fix
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (fetchError) {
      console.error('❌ Failed to verify update:', fetchError)
      return
    }
    
    console.log('\n📋 Fixed user:')
    console.log(`- Email: ${user.email}`)
    console.log(`- ID: ${user.id}`)
    console.log(`- Role: ${user.role}`)
    
    console.log('\n✅ Email mismatch fixed!')
    console.log('🎉 Now both auth and public users have matching emails!')
    
  } catch (error) {
    console.error('❌ Error fixing email mismatch:', error)
  }
}

fixEmailMismatch()