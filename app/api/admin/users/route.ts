import { NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export async function GET() {
  try {
    const user = await getUserFromSession()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all users
    const allUsers = await db.select().from(users).orderBy(users.createdAt)
    
    return NextResponse.json({ users: allUsers })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}