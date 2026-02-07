'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Users,
  Crown,
  UserCheck,
  GraduationCap,
  Shield,
  RefreshCw,
  Trash2,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSuperAdmin } from '../contexts/super-admin-context';

interface OrgMembership {
  id: string;
  name: string;
}

interface PlatformUser {
  id: string;
  email: string;
  role: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationMemberships: OrgMembership[];
  createdAt: string;
  updatedAt: string;
}

export default function PlatformUsers() {
  const { organizations } = useSuperAdmin();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingRoles, setUpdatingRoles] = useState(new Set<string>());
  const [deletingUsers, setDeletingUsers] = useState(new Set<string>());
  const [roleChangeUser, setRoleChangeUser] = useState<PlatformUser | null>(null);
  const [pendingRole, setPendingRole] = useState<string>('');
  const [pendingOrgId, setPendingOrgId] = useState<string>('');

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/super-admin/users');
      const data = await response.json();

      if (response.ok) {
        setUsers(data.users);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = (user: PlatformUser, newRole: string) => {
    if (newRole === 'admin') {
      setRoleChangeUser(user);
      setPendingRole(newRole);
      setPendingOrgId(user.organizationId || '');
    } else {
      updateRole(user.id, newRole, null);
    }
  };

  const updateRole = async (userId: string, role: string, organizationId: string | null) => {
    setUpdatingRoles((prev) => new Set(prev).add(userId));

    try {
      const response = await fetch(`/api/super-admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, organizationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update role');
      }

      // Refresh to get updated data including org memberships
      await fetchUsers();

      toast.success('Role updated', {
        description: `User role changed to ${role}`,
      });
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to update role',
      });
    } finally {
      setUpdatingRoles((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const confirmRoleChange = () => {
    if (!roleChangeUser) return;
    if (pendingRole === 'admin' && !pendingOrgId) {
      toast.error('Please select an organization');
      return;
    }
    updateRole(roleChangeUser.id, pendingRole, pendingRole === 'admin' ? pendingOrgId : null);
    setRoleChangeUser(null);
    setPendingRole('');
    setPendingOrgId('');
  };

  const handleDelete = async (userId: string) => {
    setDeletingUsers((prev) => new Set(prev).add(userId));

    try {
      const response = await fetch(`/api/super-admin/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success('User deleted', { description: data.message });
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to delete user',
      });
    } finally {
      setDeletingUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-100 dark:bg-violet-900/50 dark:text-violet-300 dark:border-violet-700 dark:hover:bg-violet-900/50">
            <Shield className="h-3 w-3" />
            Super Admin
          </Badge>
        );
      case 'admin':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Crown className="h-3 w-3" />
            Admin
          </Badge>
        );
      case 'judge':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <UserCheck className="h-3 w-3" />
            Judge
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <GraduationCap className="h-3 w-3" />
            Participant
          </Badge>
        );
    }
  };

  const getUsersByRole = (role: string) => users.filter((u) => u.role === role);

  const superAdminCount = getUsersByRole('super_admin').length;
  const adminCount = getUsersByRole('admin').length;
  const judgeCount = getUsersByRole('judge').length;
  const participantCount = getUsersByRole('participant').length;

  const renderOrgCell = (user: PlatformUser) => {
    if (user.role === 'judge' && user.organizationMemberships?.length > 0) {
      return (
        <div className="flex flex-wrap gap-1">
          {user.organizationMemberships.map((org) => (
            <Badge
              key={org.id}
              variant="outline"
              className="flex items-center gap-1 text-xs"
            >
              <Building2 className="h-2.5 w-2.5" />
              {org.name}
            </Badge>
          ))}
        </div>
      );
    }
    if (user.organizationName) {
      return (
        <div className="flex items-center gap-1 text-sm">
          <Building2 className="h-3 w-3 text-muted-foreground" />
          {user.organizationName}
        </div>
      );
    }
    return <span className="text-muted-foreground text-sm">-</span>;
  };

  const renderUserTable = (roleUsers: PlatformUser[], roleType: string) => {
    if (roleUsers.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No users in this role</p>
        </div>
      );
    }

    const showOrgColumn = roleType === 'admin' || roleType === 'judge';

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={showOrgColumn ? 'w-[30%]' : 'w-[40%]'}>Email</TableHead>
              <TableHead className="w-[15%]">Role</TableHead>
              {showOrgColumn && <TableHead className="w-[20%]">Organization</TableHead>}
              <TableHead className="w-[15%]">Joined</TableHead>
              <TableHead className="w-[20%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roleUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                {showOrgColumn && <TableCell>{renderOrgCell(user)}</TableCell>}
                <TableCell className="text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {user.role === 'super_admin' ? (
                    <span className="text-xs text-muted-foreground italic">Protected</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Select
                        value={user.role}
                        onValueChange={(role) => handleRoleChange(user, role)}
                        disabled={updatingRoles.has(user.id)}
                      >
                        <SelectTrigger className="w-32">
                          {updatingRoles.has(user.id) ? (
                            <div className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span className="text-xs">...</span>
                            </div>
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="judge">Judge</SelectItem>
                          <SelectItem value="participant">Participant</SelectItem>
                        </SelectContent>
                      </Select>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deletingUsers.has(user.id)}
                          >
                            {deletingUsers.has(user.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete &quot;{user.email}&quot; and all
                              associated data. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete User
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
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
      {/* Stats */}
      <div
        className={`grid grid-cols-2 md:grid-cols-5 gap-4 ${isRefreshing ? 'opacity-60 pointer-events-none' : ''} transition-opacity duration-200`}
      >
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg mr-4 shadow-sm">
              <Users className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
              <p className="text-muted-foreground text-sm">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-lg mr-4 shadow-sm">
              <Shield className="h-6 w-6 text-violet-700 dark:text-violet-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{superAdminCount}</p>
              <p className="text-muted-foreground text-sm">Super Admins</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg mr-4 shadow-sm">
              <Crown className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{adminCount}</p>
              <p className="text-muted-foreground text-sm">Administrators</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg mr-4 shadow-sm">
              <UserCheck className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{judgeCount}</p>
              <p className="text-muted-foreground text-sm">Judges</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-4 shadow-sm">
              <GraduationCap className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{participantCount}</p>
              <p className="text-muted-foreground text-sm">Participants</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Management Card */}
      <Card
        className={`relative ${isRefreshing ? 'opacity-60' : ''} transition-opacity duration-200`}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Platform Users</CardTitle>
                <CardDescription>Manage all users across the platform</CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await fetchUsers();
                } finally {
                  setIsRefreshing(false);
                }
              }}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p>No users found</p>
              <p className="text-sm">Users will appear here after they sign up</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Super Admins Section */}
              <div className="border rounded-lg overflow-hidden">
                <Accordion type="multiple" defaultValue={['super_admins']}>
                  <AccordionItem value="super_admins" className="border-0">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        <span className="font-semibold">Super Admins</span>
                        <Badge variant="secondary" className="ml-2">
                          {superAdminCount}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {renderUserTable(getUsersByRole('super_admin'), 'super_admin')}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* Administrators Section */}
              <div className="border rounded-lg overflow-hidden">
                <Accordion type="multiple" defaultValue={['admins']}>
                  <AccordionItem value="admins" className="border-0">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-primary" />
                        <span className="font-semibold">Administrators</span>
                        <Badge variant="secondary" className="ml-2">
                          {adminCount}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {renderUserTable(getUsersByRole('admin'), 'admin')}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* Judges Section */}
              <div className="border rounded-lg overflow-hidden">
                <Accordion type="multiple" defaultValue={['judges']}>
                  <AccordionItem value="judges" className="border-0">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-primary" />
                        <span className="font-semibold">Judges</span>
                        <Badge variant="secondary" className="ml-2">
                          {judgeCount}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {renderUserTable(getUsersByRole('judge'), 'judge')}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* Participants Section */}
              <div className="border rounded-lg overflow-hidden">
                <Accordion type="multiple" defaultValue={['participants']}>
                  <AccordionItem value="participants" className="border-0">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-primary" />
                        <span className="font-semibold">Participants</span>
                        <Badge variant="secondary" className="ml-2">
                          {participantCount}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {renderUserTable(getUsersByRole('participant'), 'participant')}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Org Selector Dialog for Admin Role Change */}
      <Dialog
        open={!!roleChangeUser}
        onOpenChange={(open) => {
          if (!open) {
            setRoleChangeUser(null);
            setPendingRole('');
            setPendingOrgId('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Organization</DialogTitle>
            <DialogDescription>
              Select which organization this admin should belong to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User</Label>
              <p className="text-sm text-muted-foreground">{roleChangeUser?.email}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-select">Organization *</Label>
              <Select value={pendingOrgId} onValueChange={setPendingOrgId}>
                <SelectTrigger id="org-select">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmRoleChange} className="flex-1">
                Confirm Role Change
              </Button>
              <Button variant="outline" onClick={() => setRoleChangeUser(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Refreshing overlay */}
      {isRefreshing && (
        <div className="fixed inset-0 bg-background/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-background/95 backdrop-blur-md border border-border/50 rounded-lg px-6 py-4 shadow-lg flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">Refreshing users...</span>
          </div>
        </div>
      )}
    </div>
  );
}
