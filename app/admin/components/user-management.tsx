'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Loader2, Users, UserCheck, Crown, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface User {
  id: string
  email: string
  role: 'admin' | 'judge'
  createdAt: string
  updatedAt: string
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [updatingRoles, setUpdatingRoles] = useState(new Set<string>())
  const [deletingUsers, setDeletingUsers] = useState(new Set<string>())

  // Use useCallback to ensure stable reference for real-time sync
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()
      
      if (response.ok) {
        setUsers(data.users)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Error', {
        description: 'Failed to load users'
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  const updateUserRole = async (userId: string, newRole: 'admin' | 'judge') => {
    setUpdatingRoles(prev => new Set(prev).add(userId))
    
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update user role')
      }

      const data = await response.json()
      
      // Update user in state
      setUsers(prev => prev.map(user => 
        user.id === userId ? data.user : user
      ))
      
      toast.success('Success', {
        description: `User role updated to ${newRole}`
      })
    } catch (error) {
      console.error('Error updating user role:', error)
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to update user role'
      })
    } finally {
      setUpdatingRoles(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  const handleDelete = async (userId: string) => {
    setDeletingUsers(prev => new Set(prev).add(userId))
    
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete user')
      }

      setUsers(prev => prev.filter(user => user.id !== userId))
      toast.success('Success', {
        description: 'Judge deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to delete user'
      })
    } finally {
      setDeletingUsers(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  const getRoleBadge = (role: string) => {
    return role === 'admin' ? (
      <Badge variant="default" className="flex items-center gap-1">
        <Crown className="h-3 w-3" />
        Admin
      </Badge>
    ) : (
      <Badge variant="secondary" className="flex items-center gap-1">
        <UserCheck className="h-3 w-3" />
        Judge
      </Badge>
    )
  }

  const getStatsCards = () => {
    const adminCount = users.filter(u => u.role === 'admin').length
    const judgeCount = users.filter(u => u.role === 'judge').length

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className={`relative ${isRefreshing ? 'opacity-60 pointer-events-none' : ''} transition-opacity duration-200`}>
        {getStatsCards()}
      </div>
      
      <Card className={`relative ${isRefreshing ? 'opacity-60' : ''} transition-opacity duration-200`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage user roles and permissions
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={async () => {
                setIsRefreshing(true)
                try {
                  await fetchUsers()
                } finally {
                  setIsRefreshing(false)
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
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
                          {user.role === 'judge' && (
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
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the judge &quot;{user.email}&quot; and all their associated scores.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDelete(user.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete Judge
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
  )
}