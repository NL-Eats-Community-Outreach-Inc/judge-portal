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
import { Building2, Users } from 'lucide-react';
import { SuperAdminProvider } from './contexts/super-admin-context';
import { SuperAdminHeader } from './components/super-admin-header';
import { SettingsPanel } from '@/app/admin/components/settings-panel';
import OrgManagement from './components/org-management';
import PlatformUsers from './components/platform-users';

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('organizations');
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <SuperAdminProvider>
      <div className="min-h-screen bg-gradient-to-br from-violet-50/30 via-background to-purple-50/20 dark:from-violet-950/20 dark:via-background dark:to-purple-950/10">
        <SuperAdminHeader onOpenSettings={() => setSettingsOpen(true)} />

        <main className="container mx-auto px-6 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-card/60 via-card/70 to-card/60 backdrop-blur-md border border-border/30 shadow-lg rounded-xl p-1.5 h-auto min-h-[3.5rem]">
              <TabsTrigger
                value="organizations"
                className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-50 data-[state=active]:via-purple-50 data-[state=active]:to-violet-100 dark:data-[state=active]:from-violet-950/40 dark:data-[state=active]:via-purple-950/40 dark:data-[state=active]:to-violet-900/40 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300 data-[state=active]:shadow-md data-[state=active]:border-violet-200/50 dark:data-[state=active]:border-violet-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
              >
                <Building2 className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
                <span className="text-sm">Organizations</span>
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="flex items-center justify-center gap-2 relative group h-full min-h-[2.5rem] data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-50 data-[state=active]:via-indigo-50 data-[state=active]:to-purple-100 dark:data-[state=active]:from-purple-950/40 dark:data-[state=active]:via-indigo-950/40 dark:data-[state=active]:to-purple-900/40 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:shadow-md data-[state=active]:border-purple-200/50 dark:data-[state=active]:border-purple-700/30 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/80 dark:hover:from-gray-800/40 dark:hover:to-gray-700/40 transition-all duration-300 ease-out rounded-lg py-2.5 px-4 font-medium"
              >
                <Users className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
                <span className="text-sm">Users</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="organizations" className="space-y-6">
              <OrgManagement />
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <PlatformUsers />
            </TabsContent>
          </Tabs>
        </main>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent
            className="max-w-3xl max-h-[90vh] overflow-y-auto"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl md:text-3xl font-bold">Settings</DialogTitle>
              <DialogDescription>Manage your account settings and preferences</DialogDescription>
            </DialogHeader>
            <SettingsPanel onPasswordChangeSuccess={() => setSettingsOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminProvider>
  );
}
