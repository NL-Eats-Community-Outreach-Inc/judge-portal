'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  Users,
  Calendar,
  Pencil,
  Trash2,
  X,
  Loader2,
  Crown,
  Mail,
  Copy,
  Check,
  MoreVertical,
  XCircle,
} from 'lucide-react';
import { SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { OrgWithStats } from '../contexts/super-admin-context';
import { AdminInviteDialog } from './admin-invite-dialog';

interface OrgDetailPanelProps {
  org: OrgWithStats;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  variant?: 'card' | 'sheet' | 'panel';
}

interface OrgAdmin {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  inviteLink: string;
}

export default function OrgDetailPanel({
  org,
  onClose,
  onRefresh,
  variant = 'card',
}: OrgDetailPanelProps) {
  const [admins, setAdmins] = useState<OrgAdmin[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [orgInvitations, setOrgInvitations] = useState<OrgInvitation[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    name: org.name,
    slug: org.slug,
    description: org.description || '',
  });

  const fetchAdmins = useCallback(async () => {
    try {
      const response = await fetch(`/api/super-admin/organizations/${org.id}/admins`);
      const data = await response.json();

      if (response.ok) {
        setAdmins(data.admins);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
      toast.error('Failed to load admins');
    } finally {
      setIsLoadingAdmins(false);
    }
  }, [org.id]);

  const fetchInvitations = useCallback(async () => {
    try {
      const response = await fetch(`/api/super-admin/organizations/${org.id}/invitations`);
      const data = await response.json();

      if (response.ok) {
        setOrgInvitations(data.invitations);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [org.id]);

  useEffect(() => {
    fetchAdmins();
    fetchInvitations();
  }, [fetchAdmins, fetchInvitations]);

  const handleCopyLink = async (link: string, id: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      toast.success('Link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/super-admin/organizations/${org.id}/invitations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      });

      if (response.ok) {
        toast.success('Invitation revoked');
        fetchInvitations();
      } else {
        toast.error('Failed to revoke invitation');
      }
    } catch {
      toast.error('Failed to revoke invitation');
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/super-admin/organizations/${org.id}/invitations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      });

      if (response.ok) {
        toast.success('Invitation deleted');
        fetchInvitations();
      } else {
        toast.error('Failed to delete invitation');
      }
    } catch {
      toast.error('Failed to delete invitation');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'accepted':
        return <Badge className="bg-green-500">Accepted</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/super-admin/organizations/${org.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          slug: editForm.slug,
          description: editForm.description || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update organization');
      }

      toast.success('Organization updated');
      setEditOpen(false);
      await onRefresh();
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to update organization',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/super-admin/organizations/${org.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete organization');
      }

      toast.success('Organization deleted', {
        description: data.message,
      });
      onClose();
      await onRefresh();
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to delete organization',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const actionButtons = (
    <div className="flex items-center gap-2 shrink-0">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setEditForm({
            name: org.name,
            slug: org.slug,
            description: org.description || '',
          });
          setEditOpen(true);
        }}
      >
        <Pencil className="h-4 w-4 sm:mr-1" />
        <span className={variant === 'sheet' ? '' : 'hidden sm:inline'}>Edit</span>
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:border-red-800/60 dark:hover:bg-red-950/50 dark:hover:text-red-300"
          >
            <Trash2 className="h-4 w-4 sm:mr-1" />
            <span className={variant === 'sheet' ? '' : 'hidden sm:inline'}>Delete</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently deleting &quot;{org.name}&quot; will destroy all its events, teams,
              scoring criteria, scores, and judge assignments. Admin users in this organization will
              lose access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {variant === 'card' && (
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      )}
      {variant === 'panel' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  const panelContent = (
    <div className="space-y-6">
      {/* Org Info */}
      {org.description && <p className="text-sm text-muted-foreground">{org.description}</p>}

      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {isLoadingAdmins ? org.adminCount : admins.length} admin
          {(isLoadingAdmins ? org.adminCount : admins.length) !== 1 ? 's' : ''}
        </Badge>
        <Badge variant="outline" className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {org.eventCount} event{org.eventCount !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Admins Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Administrators</h3>
          </div>
          <AdminInviteDialog
            orgId={org.id}
            orgName={org.name}
            onInviteSent={() => {
              fetchAdmins();
              fetchInvitations();
              onRefresh();
            }}
          />
        </div>

        {isLoadingAdmins ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground border rounded-lg">
            <Mail className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm">No admins assigned</p>
            <p className="text-xs">Invite an admin to manage this organization</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.email}</TableCell>
                    <TableCell>
                      <Badge variant="default" className="flex items-center gap-1 w-fit">
                        <Crown className="h-3 w-3" />
                        Admin
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Invitations Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Invitations</h3>
        </div>

        {isLoadingInvitations ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : orgInvitations.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground border rounded-lg">
            <Mail className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm">No invitations sent</p>
            <p className="text-xs">Use the invite button above to send admin invitations</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgInvitations.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>{getStatusBadge(invite.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(invite.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {invite.status === 'pending' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleCopyLink(invite.inviteLink, invite.id)}
                              >
                                {copiedId === invite.id ? (
                                  <Check className="h-4 w-4 mr-2 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4 mr-2" />
                                )}
                                Copy Invite Link
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRevokeInvitation(invite.id)}
                                className="text-orange-600"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Revoke
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDeleteInvitation(invite.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );

  const editDialog = (
    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
          <DialogDescription>Update organization details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              disabled={isUpdating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-slug">Slug *</Label>
            <Input
              id="edit-slug"
              value={editForm.slug}
              onChange={(e) => setEditForm((prev) => ({ ...prev, slug: e.target.value }))}
              required
              disabled={isUpdating}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              disabled={isUpdating}
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isUpdating} className="flex-1">
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (variant === 'sheet') {
    return (
      <>
        <SheetHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40 rounded-lg flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="flex items-center gap-2 flex-nowrap min-w-0">
                  <span className="truncate">{org.name}</span>
                  <Badge
                    variant="outline"
                    className="text-xs font-mono font-normal truncate max-w-[120px] shrink-0"
                  >
                    /{org.slug}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  Created {new Date(org.createdAt).toLocaleDateString()}
                </SheetDescription>
              </div>
            </div>
            {actionButtons}
          </div>
        </SheetHeader>
        <div className="px-4 pb-6 overflow-y-auto">{panelContent}</div>
        {editDialog}
      </>
    );
  }

  return (
    <Card
      className={cn(
        'border-violet-200 dark:border-violet-800/50',
        variant === 'panel' && 'h-full flex flex-col overflow-hidden'
      )}
    >
      <CardHeader className={cn(variant === 'panel' && 'shrink-0')}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 flex-wrap">
                {org.name}
                <Badge variant="outline" className="text-xs font-mono">
                  /{org.slug}
                </Badge>
              </CardTitle>
              <CardDescription>
                Created {new Date(org.createdAt).toLocaleDateString()}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">{actionButtons}</div>
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-6', variant === 'panel' && 'flex-1 overflow-y-auto')}>
        {panelContent}
      </CardContent>
      {editDialog}
    </Card>
  );
}
