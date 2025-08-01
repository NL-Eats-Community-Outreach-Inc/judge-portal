'use client'

import { useState, useEffect } from 'react'
import { JudgeSidebar } from './judge-sidebar'
import { JudgeHeader } from './judge-header'
import type { UserWithRole } from '@/lib/auth'

interface JudgeLayoutClientProps {
  user: UserWithRole
  children: React.ReactNode
}

export function JudgeLayoutClient({ user, children }: JudgeLayoutClientProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  // Set CSS custom property for dynamic viewport height (mobile browser fix)
  useEffect(() => {
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }

    // Set initial value
    setViewportHeight()

    // Update on resize (includes mobile browser UI show/hide)
    window.addEventListener('resize', setViewportHeight)
    window.addEventListener('orientationchange', setViewportHeight)

    return () => {
      window.removeEventListener('resize', setViewportHeight)
      window.removeEventListener('orientationchange', setViewportHeight)
    }
  }, [])

  return (
    <div className="h-screen-safe flex bg-background overflow-hidden" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* Desktop sidebar - hidden on mobile, visible on desktop */}
      <div className="hidden md:block shrink-0">
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
      <div className="flex-1 flex flex-col min-w-0">
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