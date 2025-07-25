import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth/server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get user session and role
  const user = await getUserFromSession()
  
  // Redirect if not authenticated or not an admin
  if (!user || user.role !== 'admin') {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}