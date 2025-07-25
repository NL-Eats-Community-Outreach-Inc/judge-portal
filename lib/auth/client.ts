import { createClient } from '@/lib/supabase/client'

export type UserRole = 'admin' | 'judge'

// Client-side authentication utilities only
export const authClient = {
  async signOut() {
    const supabase = createClient()
    return await supabase.auth.signOut()
  },

  async signInWithEmail(email: string, password: string) {
    const supabase = createClient()
    return await supabase.auth.signInWithPassword({ email, password })
  },

  async signUpWithEmail(email: string, password: string) {
    const supabase = createClient()
    // Database trigger will automatically create user in public.users table
    return await supabase.auth.signUp({ email, password })
  },

  async getUser() {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    return error || !user ? null : user
  }
}