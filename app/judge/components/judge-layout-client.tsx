'use client'

import { useState, useEffect } from 'react'
import { JudgeSidebar } from './judge-sidebar'
import { JudgeHeader } from './judge-header'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { UserWithRole } from '@/lib/auth'

interface JudgeLayoutClientProps {
  user: UserWithRole
  children: React.ReactNode
}

export function JudgeLayoutClient({ user, children }: JudgeLayoutClientProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar - hidden on mobile, visible on desktop */}
        <div className="hidden md:block fixed left-0 top-0 h-full z-40">
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
        <div className="md:ml-64 lg:ml-80">
          <div className="sticky top-0 z-30 bg-background">
            <JudgeHeader 
              user={user}
              onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}
            />
          </div>
          <main>
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}