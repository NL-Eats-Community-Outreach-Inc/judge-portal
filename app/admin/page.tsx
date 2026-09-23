'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Settings, Users, Trophy, Target, BarChart3 } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import {
  DashboardTabs,
  DashboardTabsList,
  DashboardTab,
  DashboardTabContent,
} from '@/components/dashboard-tabs';
import { ROLE_THEME } from '@/lib/theme';
import { AdminEventProvider, useAdminEvent } from './contexts/admin-event-context';
import { SettingsPanel } from './components/settings-panel';
import EventSelector from './components/event-selector';
import EventManagement from './components/event-management';
import UserManagement from './components/user-management';
import TeamManagement from './components/team-management';
import CriteriaManagement from './components/criteria-management';
import ResultsDashboard from './components/results-dashboard';

function AdminHeader({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { organizationName } = useAdminEvent();
  return (
    <AppHeader
      role="admin"
      title="Admin Portal"
      subtitle={organizationName ?? 'Manage your judging events'}
      onOpenSettings={onOpenSettings}
      sticky
    />
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('event');
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <AdminEventProvider>
      <div className={`min-h-screen ${ROLE_THEME.admin.pageGradient}`}>
        <AdminHeader onOpenSettings={() => setSettingsOpen(true)} />

        <div className="container mx-auto px-4 md:px-6 pt-6">
          <EventSelector />
        </div>

        <main className="container mx-auto px-4 md:px-6 py-6">
          <DashboardTabs role="admin" value={activeTab} onValueChange={setActiveTab}>
            <DashboardTabsList columns={5}>
              <DashboardTab value="event" icon={Settings}>
                Events
              </DashboardTab>
              <DashboardTab value="teams" icon={Trophy}>
                Teams
              </DashboardTab>
              <DashboardTab value="criteria" icon={Target}>
                Criteria
              </DashboardTab>
              <DashboardTab value="results" icon={BarChart3}>
                Results
              </DashboardTab>
              <DashboardTab value="users" icon={Users}>
                Users
              </DashboardTab>
            </DashboardTabsList>

            <DashboardTabContent value="event" className="space-y-6">
              <EventManagement />
            </DashboardTabContent>
            <DashboardTabContent value="teams" className="space-y-6">
              <TeamManagement />
            </DashboardTabContent>
            <DashboardTabContent value="criteria" className="space-y-6">
              <CriteriaManagement />
            </DashboardTabContent>
            <DashboardTabContent value="results" className="space-y-6">
              <ResultsDashboard />
            </DashboardTabContent>
            <DashboardTabContent value="users" className="space-y-6">
              <UserManagement />
            </DashboardTabContent>
          </DashboardTabs>
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
    </AdminEventProvider>
  );
}
