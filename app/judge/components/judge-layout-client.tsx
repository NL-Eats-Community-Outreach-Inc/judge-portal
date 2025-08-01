'use client'

import { useState } from 'react'
import { JudgeSidebar } from './judge-sidebar'
import { JudgeHeader } from './judge-header'
import type { UserWithRole } from '@/lib/auth'

interface JudgeLayoutClientProps {
  user: UserWithRole
  children: React.ReactNode
}

export function JudgeLayoutClient({ user, children }: JudgeLayoutClientProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  return (
    <div className="h-screen flex bg-background">
      {/* Desktop sidebar - hidden on mobile, visible on desktop */}
      <div className="hidden md:block">
        <JudgeSidebar />
      </div>
      
      {/* Mobile sidebar - only visible on mobile */}
      <div className="md:hidden">
        <JudgeSidebar 
          isMobile={true}
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      </div>
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        <JudgeHeader 
          user={user}
          onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}