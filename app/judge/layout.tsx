import { authServer } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { JudgeLayoutClient } from './components/judge-layout-client'

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

  return <JudgeLayoutClient user={user}>{children}</JudgeLayoutClient>
}