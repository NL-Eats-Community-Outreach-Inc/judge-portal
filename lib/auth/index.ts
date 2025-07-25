import { createClient as createServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { User } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'judge'

export interface UserWithRole extends User {
  role?: UserRole
}


// Server-side authentication utilities
export const authServer = {
  async getUser() {
    const supabase = await createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) return null
    
    // Get user role from our users table
    const userRecord = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
    
    return {
      ...user,
      role: userRecord[0]?.role as UserRole
    }
  },

  async requireAuth() {
    const user = await this.getUser()
    if (!user) {
      throw new Error('Authentication required')
    }
    return user
  },

  async requireRole(requiredRole: UserRole) {
    const user = await this.requireAuth()
    if (user.role !== requiredRole) {
      throw new Error(`${requiredRole} role required`)
    }
    return user
  },

  async requireAdmin() {
    return await this.requireRole('admin')
  },

  async requireJudge() {
    return await this.requireRole('judge')
  }
}

// User management utilities
export const userManager = {
  async createUserRecord(authUser: User, role: UserRole = 'judge') {
    return await db.insert(users).values({
      id: authUser.id,
      email: authUser.email!,
      role
    }).returning()
  },

  async updateUserRole(userId: string, role: UserRole) {
    return await db.update(users)
      .set({ role, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId))
      .returning()
  },

  async getUserRole(userId: string): Promise<UserRole | null> {
    const userRecord = await db.select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    
    return userRecord[0]?.role as UserRole || null
  }
}

// Route protection utilities
export const routeGuards = {
  adminOnly: async () => {
    try {
      await authServer.requireAdmin()
      return true
    } catch {
      return false
    }
  },

  judgeOnly: async () => {
    try {
      await authServer.requireJudge()
      return true
    } catch {
      return false
    }
  },

  authenticated: async () => {
    try {
      await authServer.requireAuth()
      return true
    } catch {
      return false
    }
  }
}