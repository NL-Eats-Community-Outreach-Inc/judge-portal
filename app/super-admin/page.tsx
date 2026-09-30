'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, Users } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import {
  DashboardTabs,
  DashboardTabsList,
  DashboardTab,
  DashboardTabContent,
} from '@/components/dashboard-tabs';
import { ROLE_THEME } from '@/lib/theme';
import { SuperAdminProvider } from './contexts/super-admin-context';
import { SettingsPanel } from '@/app/admin/components/settings-panel';
import OrgManagement from './components/org-management';
import PlatformUsers from './components/platform-users';

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('organizations');
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <SuperAdminProvider>
      <div className={`min-h-screen ${ROLE_THEME.super_admin.pageGradient}`}>
        <AppHeader
          role="super_admin"
          title="Super Admin Portal"
          subtitle="Platform management"
          onOpenSettings={() => setSettingsOpen(true)}
          sticky
        />

        <main className="container mx-auto px-4 md:px-6 py-4 md:py-6">
          <DashboardTabs role="super_admin" value={activeTab} onValueChange={setActiveTab}>
            <DashboardTabsList columns={2}>
              <DashboardTab value="organizations" icon={Building2}>
                Organizations
              </DashboardTab>
              <DashboardTab value="users" icon={Users}>
                Users
              </DashboardTab>
            </DashboardTabsList>

            <DashboardTabContent value="organizations" className="space-y-6">
              <OrgManagement />
            </DashboardTabContent>
            <DashboardTabContent value="users" className="space-y-6">
              <PlatformUsers />
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
    </SuperAdminProvider>
  );
}
