'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Trophy, Users } from 'lucide-react';
import { EventTab } from './event-tab';
import { CriteriaTab } from './criteria-tab';
import { TeamsTab } from './teams-tab';

export function ParticipantTabs() {
  const [activeTab, setActiveTab] = useState('events');

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-card/60 via-card/70 to-card/60 backdrop-blur-md border border-border/30 shadow-lg rounded-xl p-1.5 h-auto min-h-[3.5rem]">
          <TabsTrigger
            value="events"
            className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-50 data-[state=active]:via-indigo-50 data-[state=active]:to-blue-100 dark:data-[state=active]:from-blue-950/40 dark:data-[state=active]:via-indigo-950/40 dark:data-[state=active]:to-blue-900/40 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-md data-[state=active]:border-blue-200/50 dark:data-[state=active]:border-blue-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
          >
            <Calendar className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
            <span className="text-sm">Events</span>
          </TabsTrigger>
          <TabsTrigger
            value="criteria"
            className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-50 data-[state=active]:via-teal-50 data-[state=active]:to-cyan-100 dark:data-[state=active]:from-cyan-950/40 dark:data-[state=active]:via-teal-950/40 dark:data-[state=active]:to-cyan-900/40 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-300 data-[state=active]:shadow-md data-[state=active]:border-teal-200/50 dark:data-[state=active]:border-teal-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
          >
            <Trophy className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
            <span className="text-sm">Criteria</span>
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-50 data-[state=active]:via-purple-50 data-[state=active]:to-violet-50 dark:data-[state=active]:from-teal-950/40 dark:data-[state=active]:via-purple-950/40 dark:data-[state=active]:to-violet-950/40 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:shadow-md data-[state=active]:border-purple-200/50 dark:data-[state=active]:border-purple-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
          >
            <Users className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
            <span className="text-sm">Teams</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-6">
          <EventTab />
        </TabsContent>

        <TabsContent value="criteria" className="space-y-6">
          <CriteriaTab />
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <TeamsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
