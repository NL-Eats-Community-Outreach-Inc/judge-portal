'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Building2,
  Plus,
  Users,
  Calendar as CalendarIcon,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from 'sonner';
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
    <div className="space-y-6">
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

      {/* Org List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary shrink-0" />
              <div>
                <CardTitle>Organizations</CardTitle>
                <CardDescription>Manage platform organizations</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">New Organization</span>
                    <span className="sm:hidden">New Org</span>
                  </Button>
                </DialogTrigger>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p>No organizations yet</p>
              <p className="text-sm">Create your first organization to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {organizations.map((org) => (
                <OrgCard
                  key={org.id}
                  org={org}
                  isSelected={selectedOrg?.id === org.id}
                  onSelect={() => selectOrg(org.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Org Detail Panel - Desktop: inline card */}
      {selectedOrg && !isMobile && (
        <OrgDetailPanel
          org={selectedOrg}
          onClose={() => selectOrg(null)}
          onRefresh={refreshOrgs}
        />
      )}

      {/* Org Detail Panel - Mobile: bottom sheet */}
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
    </div>
  );
}

function OrgCard({ org, isSelected, onSelect }: { org: OrgWithStats; isSelected: boolean; onSelect: () => void }) {
  return (
    <Card
      className={`group cursor-pointer hover:shadow-md transition-all duration-200 hover:border-violet-200 dark:hover:border-violet-800 ${
        isSelected
          ? 'border-violet-500 dark:border-violet-500 shadow-md ring-1 ring-violet-500/30 bg-violet-50/50 dark:bg-violet-950/20'
          : ''
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40 rounded-lg flex items-center justify-center">
              <Building2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                {org.name}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">/{org.slug}</p>
            </div>
          </div>
        </div>

        {org.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{org.description}</p>
        )}

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {org.adminCount} admin{org.adminCount !== 1 ? 's' : ''}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <CalendarIcon className="h-3 w-3 mr-1" />
            {org.eventCount} event{org.eventCount !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
