'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { LogOut, Settings, Users, Trophy, Target, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { AdminEventProvider } from './contexts/admin-event-context'
import EventSelector from './components/event-selector'
import EventManagement from './components/event-management'
import UserManagement from './components/user-management'
import TeamManagement from './components/team-management'
import CriteriaManagement from './components/criteria-management'
import ResultsDashboard from './components/results-dashboard'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('event')
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <AdminEventProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50/30 via-background to-slate-50/20 dark:from-gray-950/50 dark:via-background dark:to-gray-900/20">
        {/* Header */}
        <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-gray-700 to-gray-800 dark:from-gray-600 dark:to-gray-700 rounded-lg flex items-center justify-center shadow-sm">
                  <Settings className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Admin Portal</h1>
                  <p className="text-sm text-muted-foreground">Manage your judging events</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ThemeSwitcher />
                <Button 
                  variant="outline" 
                  onClick={handleSignOut}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Event Selector */}
        <div className="container mx-auto px-6 pt-6">
          <EventSelector />
        </div>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-gradient-to-r from-card/60 via-card/70 to-card/60 backdrop-blur-md border border-border/30 shadow-lg rounded-xl p-1.5 h-auto min-h-[3.5rem]">
            <TabsTrigger 
              value="event" 
              className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-50 data-[state=active]:via-indigo-50 data-[state=active]:to-purple-50 dark:data-[state=active]:from-blue-950/40 dark:data-[state=active]:via-indigo-950/40 dark:data-[state=active]:to-purple-950/40 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-md data-[state=active]:border-blue-200/50 dark:data-[state=active]:border-blue-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
            >
              <Settings className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
              <span className="text-sm">Events</span>
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-50 data-[state=active]:via-emerald-50 data-[state=active]:to-teal-50 dark:data-[state=active]:from-green-950/40 dark:data-[state=active]:via-emerald-950/40 dark:data-[state=active]:to-teal-950/40 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-300 data-[state=active]:shadow-md data-[state=active]:border-green-200/50 dark:data-[state=active]:border-green-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
            >
              <Users className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
              <span className="text-sm">Users</span>
            </TabsTrigger>
            <TabsTrigger 
              value="teams" 
              className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-50 data-[state=active]:via-orange-50 data-[state=active]:to-yellow-50 dark:data-[state=active]:from-amber-950/40 dark:data-[state=active]:via-orange-950/40 dark:data-[state=active]:to-yellow-950/40 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300 data-[state=active]:shadow-md data-[state=active]:border-amber-200/50 dark:data-[state=active]:border-amber-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
            >
              <Trophy className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
              <span className="text-sm">Teams</span>
            </TabsTrigger>
            <TabsTrigger 
              value="criteria" 
              className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-50 data-[state=active]:via-pink-50 data-[state=active]:to-red-50 dark:data-[state=active]:from-rose-950/40 dark:data-[state=active]:via-pink-950/40 dark:data-[state=active]:to-red-950/40 data-[state=active]:text-rose-700 dark:data-[state=active]:text-rose-300 data-[state=active]:shadow-md data-[state=active]:border-rose-200/50 dark:data-[state=active]:border-rose-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
            >
              <Target className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
              <span className="text-sm">Criteria</span>
            </TabsTrigger>
            <TabsTrigger 
              value="results" 
              className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-50 data-[state=active]:via-purple-50 data-[state=active]:to-indigo-50 dark:data-[state=active]:from-violet-950/40 dark:data-[state=active]:via-purple-950/40 dark:data-[state=active]:to-indigo-950/40 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300 data-[state=active]:shadow-md data-[state=active]:border-violet-200/50 dark:data-[state=active]:border-violet-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
            >
              <BarChart3 className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
              <span className="text-sm">Results</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="event" className="space-y-6">
            <EventManagement />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="teams" className="space-y-6">
            <TeamManagement />
          </TabsContent>

          <TabsContent value="criteria" className="space-y-6">
            <CriteriaManagement />
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <ResultsDashboard />
          </TabsContent>
        </Tabs>
        </main>
      </div>
    </AdminEventProvider>
  )
}