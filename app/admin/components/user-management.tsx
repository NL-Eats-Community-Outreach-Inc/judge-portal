'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminEvent } from '../contexts/admin-event-context';
import { InviteJudgesDialog } from './invite-judges-dialog';
import { InvitationsList } from './invitations-list';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Loader2, Users, UserCheck, Crown, RefreshCw, Trash2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'judge' | 'participant';
  createdAt: string;
  updatedAt: string;
}

export default function UserManagement() {
  const { selectedEvent } = useAdminEvent();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingRoles, setUpdatingRoles] = useState(new Set<string>());
  const [deletingUsers, setDeletingUsers] = useState(new Set<string>());
  const [invitationRefreshTrigger, setInvitationRefreshTrigger] = useState(0);

  // Use useCallback to ensure stable reference for real-time sync
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();

      if (response.ok) {
        setUsers(data.users);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error', {
        description: 'Failed to load users',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateUserRole = async (userId: string, newRole: 'admin' | 'judge') => {
    setUpdatingRoles((prev) => new Set(prev).add(userId));

    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user role');
      }

      const data = await response.json();

      // Update user in state
      setUsers((prev) => prev.map((user) => (user.id === userId ? data.user : user)));

      toast.success('Success', {
        description: `User role updated to ${newRole}`,
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to update user role',
      });
    } finally {
      setUpdatingRoles((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleDelete = async (userId: string) => {
    setDeletingUsers((prev) => new Set(prev).add(userId));

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      setUsers((prev) => prev.filter((user) => user.id !== userId));
      toast.success('Success', {
        description: 'User deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting user:', error);
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
    if (role === 'admin') {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <Crown className="h-3 w-3" />
          Admin
        </Badge>
      );
    } else if (role === 'judge') {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <UserCheck className="h-3 w-3" />
          Judge
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <GraduationCap className="h-3 w-3" />
          Participant
        </Badge>
      );
    }
  };

  const getStatsCards = () => {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    const judgeCount = users.filter((u) => u.role === 'judge').length;
    const participantCount = users.filter((u) => u.role === 'participant').length;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
    );
  };

  // Helper function to split users by role
  const getUsersByRole = (role: 'admin' | 'judge' | 'participant') => {
    return users.filter((u) => u.role === role);
  };

  // Render user table with role-specific actions
  const renderUserTable = (roleUsers: User[], roleType: 'admin' | 'judge' | 'participant') => {
    if (roleUsers.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No users in this role</p>
        </div>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">Email</TableHead>
              <TableHead className="w-[25%]">Role</TableHead>
              <TableHead className="w-[20%]">Joined</TableHead>
              <TableHead className="w-[20%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roleUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium w-[35%]">{user.email}</TableCell>
                <TableCell className="w-[25%]">{getRoleBadge(user.role)}</TableCell>
                <TableCell className="text-muted-foreground w-[20%]">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="w-[20%]">
                  <div className="flex items-center gap-2">
                    {/* Show role change dropdown only for admin/judge */}
                    {roleType !== 'participant' && (
                      <Select
                        value={user.role}
                        onValueChange={(role: 'admin' | 'judge') => updateUserRole(user.id, role)}
                        disabled={updatingRoles.has(user.id)}
                      >
                        <SelectTrigger className="w-32">
                          {updatingRoles.has(user.id) ? (
                            <div className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span className="text-xs">•••</span>
                            </div>
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="judge">Judge</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {/* Show delete button for judges and participants */}
                    {(user.role === 'judge' || user.role === 'participant') && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={deletingUsers.has(user.id)}>
                            {deletingUsers.has(user.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the{' '}
                              {user.role} &quot;{user.email}&quot;
                              {user.role === 'judge' && ' and all their associated scores'}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete {user.role === 'judge' ? 'Judge' : 'Participant'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
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
      <div
        className={`relative ${isRefreshing ? 'opacity-60 pointer-events-none' : ''} transition-opacity duration-200`}
      >
        {getStatsCards()}
      </div>

      {/* Judge Invitations Section */}
      <InvitationsList
        refreshTrigger={invitationRefreshTrigger}
        actionButton={
          <InviteJudgesDialog
            onInvitesSent={() => setInvitationRefreshTrigger((prev) => prev + 1)}
          />
        }
      />

      <Card
        className={`relative ${isRefreshing ? 'opacity-60' : ''} transition-opacity duration-200`}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user roles and permissions</CardDescription>
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
              {/* Administrators Section */}
              <div className="border rounded-lg overflow-hidden">
                <Accordion type="multiple" defaultValue={['admins']}>
                  <AccordionItem value="admins" className="border-0">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-primary" />
                        <span className="font-semibold">Administrators</span>
                        <Badge variant="secondary" className="ml-2">
                          {getUsersByRole('admin').length}
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
                          {getUsersByRole('judge').length}
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
                          {getUsersByRole('participant').length}
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

      {/* Subtle loading overlay */}
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
