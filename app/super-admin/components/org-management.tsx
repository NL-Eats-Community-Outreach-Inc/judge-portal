'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2,
  Plus,
  Users,
  Calendar as CalendarIcon,
  RefreshCw,
  Loader2,
  MousePointerClick,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/hooks/use-media-query';
import { useSuperAdmin, type OrgWithStats } from '../contexts/super-admin-context';
import OrgDetailPanel from './org-detail-panel';

export default function OrgManagement() {
  const { organizations, isLoading, refreshOrgs, selectOrg, selectedOrg } = useSuperAdmin();
  const isMobile = useIsMobile();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  });

  const totalAdmins = organizations.reduce((sum, org) => sum + org.adminCount, 0);
  const totalEvents = organizations.reduce((sum, org) => sum + org.eventCount, 0);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshOrgs();
    } finally {
      setIsRefreshing(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: generateSlug(name),
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch('/api/super-admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }

      toast.success('Organization created', {
        description: `"${data.organization.name}" has been created`,
      });
      setCreateOpen(false);
      setFormData({ name: '', slug: '', description: '' });
      await refreshOrgs();
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to create organization',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Create org dialog (shared between mobile and desktop)
  const createOrgDialog = (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Add a new organization to the platform
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Name *</Label>
            <Input
              id="org-name"
              placeholder="Acme Hackathons"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              disabled={isCreating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">Slug *</Label>
            <Input
              id="org-slug"
              placeholder="acme-hackathons"
              value={formData.slug}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, slug: e.target.value }))
              }
              required
              disabled={isCreating}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              URL-friendly identifier. Auto-generated from name.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-description">Description</Label>
            <Textarea
              id="org-description"
              placeholder="Brief description of the organization..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              disabled={isCreating}
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isCreating} className="flex-1">
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreating ? 'Creating...' : 'Create Organization'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  // Org list content (shared between mobile card and desktop left panel)
  const orgListContent = organizations.length === 0 ? (
    <div className="text-center py-12 text-muted-foreground">
      <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
      <p>No organizations yet</p>
      <p className="text-sm">Create your first organization to get started</p>
    </div>
  ) : (
    <div className="divide-y divide-border/50">
      {organizations.map((org) => (
        <OrgListItem
          key={org.id}
          org={org}
          isSelected={selectedOrg?.id === org.id}
          onSelect={() => selectOrg(org.id)}
        />
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-lg mr-4 shadow-sm">
              <Building2 className="h-6 w-6 text-violet-700 dark:text-violet-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{organizations.length}</p>
              <p className="text-muted-foreground text-sm">Organizations</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg mr-4 shadow-sm">
              <Users className="h-6 w-6 text-purple-700 dark:text-purple-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalAdmins}</p>
              <p className="text-muted-foreground text-sm">Total Admins</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg mr-4 shadow-sm">
              <CalendarIcon className="h-6 w-6 text-indigo-700 dark:text-indigo-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalEvents}</p>
              <p className="text-muted-foreground text-sm">Total Events</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile: Full-width org list */}
      <div className="md:hidden">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-5 w-5 text-primary shrink-0" />
                <CardTitle className="text-base">Organizations</CardTitle>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-8 w-8"
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {orgListContent}
          </CardContent>
        </Card>
      </div>

      {/* Desktop: Master-Detail side-by-side layout */}
      <div className="hidden md:flex gap-4 h-[calc(100vh-280px)] min-h-[400px]">
        {/* Left panel: Org list */}
        <Card className="w-[340px] lg:w-[380px] shrink-0 flex flex-col overflow-hidden">
          <CardHeader className="shrink-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <CardTitle className="text-sm font-semibold">Organizations</CardTitle>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-7 w-7"
                >
                  {isRefreshing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New
                </Button>
              </div>
            </div>
          </CardHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {orgListContent}
          </div>
        </Card>

        {/* Right panel: Detail or empty state */}
        <div className="flex-1 min-w-0">
          {selectedOrg ? (
            <OrgDetailPanel
              org={selectedOrg}
              onClose={() => selectOrg(null)}
              onRefresh={refreshOrgs}
              variant="panel"
            />
          ) : (
            <OrgEmptyState />
          )}
        </div>
      </div>

      {/* Mobile: Bottom Sheet for detail */}
      <Sheet
        open={!!selectedOrg && isMobile}
        onOpenChange={(open) => { if (!open) selectOrg(null); }}
      >
        <SheetContent side="bottom" className="max-h-[85vh] p-0 rounded-t-xl">
          {selectedOrg && (
            <OrgDetailPanel
              org={selectedOrg}
              onClose={() => selectOrg(null)}
              onRefresh={refreshOrgs}
              variant="sheet"
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Shared create dialog */}
      {createOrgDialog}
    </div>
  );
}

function OrgListItem({ org, isSelected, onSelect }: { org: OrgWithStats; isSelected: boolean; onSelect: () => void }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-200 rounded-r-md",
        "border-l-[3px] border-transparent hover:bg-muted/50",
        isSelected && "border-l-violet-500 bg-violet-50/60 dark:bg-violet-950/25 hover:bg-violet-50/80 dark:hover:bg-violet-950/35"
      )}
      onClick={onSelect}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200",
        isSelected
          ? "bg-gradient-to-br from-violet-200 to-purple-200 dark:from-violet-800/50 dark:to-purple-800/50"
          : "bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30"
      )}>
        <Building2 className={cn(
          "h-4 w-4 transition-colors duration-200",
          isSelected
            ? "text-violet-700 dark:text-violet-300"
            : "text-violet-500 dark:text-violet-400"
        )} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className={cn(
            "font-medium text-sm truncate transition-colors duration-200",
            isSelected ? "text-violet-900 dark:text-violet-100" : "text-foreground"
          )}>
            {org.name}
          </h3>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">/{org.slug}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
            <Users className="h-3 w-3" />
            {org.adminCount}
          </span>
          <span className="text-muted-foreground/40 text-[10px]">&middot;</span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
            <CalendarIcon className="h-3 w-3" />
            {org.eventCount}
          </span>
        </div>
      </div>
    </div>
  );
}

function OrgEmptyState() {
  return (
    <Card className="h-full flex items-center justify-center border-dashed border-2 border-border/50 bg-muted/5">
      <div className="text-center space-y-3 p-8">
        <div className="w-14 h-14 mx-auto bg-violet-50 dark:bg-violet-950/30 rounded-xl flex items-center justify-center">
          <MousePointerClick className="h-7 w-7 text-violet-400 dark:text-violet-500" />
        </div>
        <div>
          <h3 className="font-medium text-foreground text-sm">Select an Organization</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Choose an organization from the list to view and manage its details
          </p>
        </div>
      </div>
    </Card>
  );
}
