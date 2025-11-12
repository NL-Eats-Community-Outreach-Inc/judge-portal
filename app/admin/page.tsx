'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Settings, Users, Trophy, Target, BarChart3 } from 'lucide-react';
import { AdminEventProvider } from './contexts/admin-event-context';
import { AdminHeader } from './components/admin-header';
import { SettingsPanel } from './components/settings-panel';
import EventSelector from './components/event-selector';
import EventManagement from './components/event-management';
import UserManagement from './components/user-management';
import TeamManagement from './components/team-management';
import CriteriaManagement from './components/criteria-management';
import ResultsDashboard from './components/results-dashboard';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('event');
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <AdminEventProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50/30 via-background to-slate-50/20 dark:from-gray-950/50 dark:via-background dark:to-gray-900/20">
        <AdminHeader onOpenSettings={() => setSettingsOpen(true)} />

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
                className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-50 data-[state=active]:via-indigo-50 data-[state=active]:to-blue-100 dark:data-[state=active]:from-blue-950/40 dark:data-[state=active]:via-indigo-950/40 dark:data-[state=active]:to-blue-900/40 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-md data-[state=active]:border-blue-200/50 dark:data-[state=active]:border-blue-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
              >
                <Settings className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
                <span className="text-sm">Events</span>
              </TabsTrigger>
              <TabsTrigger
                value="teams"
                className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-50 data-[state=active]:via-cyan-50 data-[state=active]:to-sky-50 dark:data-[state=active]:from-blue-950/40 dark:data-[state=active]:via-cyan-950/40 dark:data-[state=active]:to-sky-950/40 data-[state=active]:text-cyan-700 dark:data-[state=active]:text-cyan-300 data-[state=active]:shadow-md data-[state=active]:border-cyan-200/50 dark:data-[state=active]:border-cyan-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
              >
                <Trophy className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
                <span className="text-sm">Teams</span>
              </TabsTrigger>
              <TabsTrigger
                value="criteria"
                className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-50 data-[state=active]:via-teal-50 data-[state=active]:to-cyan-100 dark:data-[state=active]:from-cyan-950/40 dark:data-[state=active]:via-teal-950/40 dark:data-[state=active]:to-cyan-900/40 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-300 data-[state=active]:shadow-md data-[state=active]:border-teal-200/50 dark:data-[state=active]:border-teal-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
              >
                <Target className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
                <span className="text-sm">Criteria</span>
              </TabsTrigger>
              <TabsTrigger
                value="results"
                className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-50 data-[state=active]:via-purple-50 data-[state=active]:to-violet-50 dark:data-[state=active]:from-teal-950/40 dark:data-[state=active]:via-purple-950/40 dark:data-[state=active]:to-violet-950/40 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:shadow-md data-[state=active]:border-purple-200/50 dark:data-[state=active]:border-purple-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
              >
                <BarChart3 className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
                <span className="text-sm">Results</span>
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-50 data-[state=active]:via-violet-50 data-[state=active]:to-indigo-50 dark:data-[state=active]:from-purple-950/40 dark:data-[state=active]:via-violet-950/40 dark:data-[state=active]:to-indigo-950/40 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300 data-[state=active]:shadow-md data-[state=active]:border-violet-200/50 dark:data-[state=active]:border-violet-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
              >
                <Users className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
                <span className="text-sm">Users</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="event" className="space-y-6">
              <EventManagement />
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

            <TabsContent value="users" className="space-y-6">
              <UserManagement />
            </TabsContent>
          </Tabs>
        </main>

        {/* Settings Dialog */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent
            className="max-w-3xl max-h-[90vh] overflow-y-auto"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl md:text-3xl font-bold">Settings</DialogTitle>
              <DialogDescription>
                Manage your account settings and preferences
              </DialogDescription>
            </DialogHeader>
            <SettingsPanel onPasswordChangeSuccess={() => setSettingsOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </AdminEventProvider>
  );
}
