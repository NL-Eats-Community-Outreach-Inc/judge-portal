import { authServer } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { JudgeSidebar } from './components/judge-sidebar'
import { JudgeHeader } from './components/judge-header'

export default async function JudgeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authServer.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  if (user.role !== 'judge' && user.role !== 'admin') {
    redirect('/')
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <JudgeSidebar />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        <JudgeHeader user={user} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}