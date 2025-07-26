'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Loader2, Plus, Trophy, Edit, Trash2, ExternalLink, Github, RefreshCw, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminEvent } from '../contexts/admin-event-context'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Sortable Row Component
function SortableRow({ team, children, isDragDisabled }: { team: Team; children: React.ReactNode; isDragDisabled?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: team.id,
    disabled: isDragDisabled
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'z-50' : ''}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {isDragDisabled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-1 rounded cursor-not-allowed">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Cannot reorder teams in completed events</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div
              {...attributes}
              {...listeners}
              className="cursor-move p-1 rounded hover:bg-muted"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <Badge variant="outline">#{team.presentationOrder}</Badge>
        </div>
      </TableCell>
      {children}
    </TableRow>
  )
}

interface Team {
  id: string
  name: string
  description: string | null
  demoUrl: string | null
  repoUrl: string | null
  presentationOrder: number
  createdAt: string
  updatedAt: string
  eventId: string
}

interface TeamFormData {
  name: string
  description: string
  demoUrl: string
  repoUrl: string
}

export default function TeamManagement() {
  const [teams, setTeams] = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    description: '',
    demoUrl: '',
    repoUrl: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingTeams, setDeletingTeams] = useState(new Set<string>())
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null)
  const { selectedEvent } = useAdminEvent()

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!active || !over || active.id === over.id) {
      return
    }

    const oldIndex = teams.findIndex((team) => team.id === active.id)
    const newIndex = teams.findIndex((team) => team.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Optimistic update
    const newTeams = arrayMove(teams, oldIndex, newIndex)
    // Update presentation orders
    const updatedTeams = newTeams.map((team, index) => ({
      ...team,
      presentationOrder: index + 1
    }))
    
    setTeams(updatedTeams)

    // Send to backend
    try {
      const response = await fetch('/api/admin/teams/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventId: selectedEvent?.id,
          teamOrders: updatedTeams.map(team => ({
            id: team.id,
            presentationOrder: team.presentationOrder
          }))
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update team order')
      }

      toast.success('Success', {
        description: 'Team order updated successfully'
      })
    } catch (error) {
      console.error('Error updating team order:', error)
      // Revert on error
      setTeams(teams)
      toast.error('Error', {
        description: 'Failed to update team order'
      })
    }
  }

  // Use useCallback to ensure stable reference for real-time sync
  const fetchTeams = useCallback(async () => {
    if (!selectedEvent) {
      setTeams([])
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/admin/teams?eventId=${selectedEvent.id}`)
      const data = await response.json()
      
      if (response.ok) {
        setTeams(data.teams)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
      toast.error('Error', {
        description: 'Failed to load teams'
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedEvent])

  useEffect(() => {
    if (selectedEvent) {
      fetchTeams()
    }
  }, [selectedEvent, fetchTeams])


  const openDialog = (team?: Team) => {
    if (team) {
      setEditingTeam(team)
      setFormData({
        name: team.name,
        description: team.description || '',
        demoUrl: team.demoUrl || '',
        repoUrl: team.repoUrl || ''
      })
    } else {
      setEditingTeam(null)
      setFormData({
        name: '',
        description: '',
        demoUrl: '',
        repoUrl: ''
      })
    }
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingTeam(null)
    setFormData({
      name: '',
      description: '',
      demoUrl: '',
      repoUrl: ''
    })
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Validation Error', {
        description: 'Team name is required'
      })
      return
    }

    if (!selectedEvent) {
      toast.error('Error', {
        description: 'No event selected'
      })
      return
    }

    setIsSubmitting(true)
    try {
      const url = editingTeam ? `/api/admin/teams/${editingTeam.id}` : '/api/admin/teams'
      const method = editingTeam ? 'PUT' : 'POST'
      
      const requestBody = editingTeam 
        ? { ...formData, presentationOrder: editingTeam.presentationOrder } 
        : { ...formData, eventId: selectedEvent.id }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save team')
      }

      const data = await response.json()
      
      if (editingTeam) {
        setTeams(prev => prev.map(team => 
          team.id === editingTeam.id ? data.team : team
        ))
        toast.success('Success', {
          description: 'Team updated successfully'
        })
      } else {
        setTeams(prev => [...prev, data.team].sort((a, b) => a.presentationOrder - b.presentationOrder))
        toast.success('Success', {
          description: 'Team created successfully'
        })
      }
      
      closeDialog()
    } catch (error) {
      console.error('Error saving team:', error)
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to save team'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!teamToDelete) return

    setDeletingTeams(prev => new Set(prev).add(teamToDelete.id))
    
    try {
      const response = await fetch(`/api/admin/teams/${teamToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete team')
      }

      setTeams(prev => prev.filter(team => team.id !== teamToDelete.id))
      toast.success('Success', {
        description: 'Team deleted successfully'
      })
      
      setTeamToDelete(null)
    } catch (error) {
      console.error('Error deleting team:', error)
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to delete team'
      })
    } finally {
      setDeletingTeams(prev => {
        const next = new Set(prev)
        next.delete(teamToDelete.id)
        return next
      })
    }
  }

  const getStatsCard = () => (
    <Card className="mb-6">
      <CardContent className="flex items-center p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg mr-4 shadow-sm">
          <Trophy className="h-6 w-6 text-gray-700 dark:text-gray-300" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{teams.length}</p>
          <p className="text-muted-foreground text-sm">Total Teams</p>
        </div>
      </CardContent>
    </Card>
  )

  if (!selectedEvent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-center">No event selected</p>
          <p className="text-sm text-muted-foreground text-center">Select an event above to manage teams</p>
        </CardContent>
      </Card>
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
    <TooltipProvider>
      <div className="space-y-6">
        {getStatsCard()}
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Team Management</CardTitle>
                <CardDescription>
                  Create, edit, and organize competing teams for {selectedEvent.name}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={fetchTeams}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DialogTrigger asChild>
                        <Button 
                          onClick={() => openDialog()} 
                          className="flex items-center gap-2"
                          disabled={selectedEvent?.status === 'completed'}
                        >
                          <Plus className="h-4 w-4" />
                          Add Team
                        </Button>
                      </DialogTrigger>
                    </div>
                  </TooltipTrigger>
                  {selectedEvent?.status === 'completed' && (
                    <TooltipContent>
                      <p>Cannot add teams to completed events</p>
                    </TooltipContent>
                  )}
                </Tooltip>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingTeam ? 'Edit Team' : 'Create New Team'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingTeam ? 'Update team information' : 'Add a new team to the competition'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="team-name">Team Name *</Label>
                      <Input
                        id="team-name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter team name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="team-description">Description</Label>
                      <Textarea
                        id="team-description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Team description"
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="demo-url">Demo URL</Label>
                      <Input
                        id="demo-url"
                        type="url"
                        value={formData.demoUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, demoUrl: e.target.value }))}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="repo-url">Repository URL</Label>
                      <Input
                        id="repo-url"
                        type="url"
                        value={formData.repoUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, repoUrl: e.target.value }))}
                        placeholder="https://github.com/username/repository"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeDialog}>
                      Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {editingTeam ? 'Update Team' : 'Create Team'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p>No teams yet</p>
              <p className="text-sm">Create your first team to get started</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <DndContext 
                sensors={sensors} 
                collisionDetection={closestCenter} 
                onDragEnd={handleDragEnd}
              >
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Order</TableHead>
                      <TableHead className="w-48">Team Name</TableHead>
                      <TableHead className="w-64">Description</TableHead>
                      <TableHead className="w-32">Links</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext 
                      items={teams.map(team => team.id)} 
                      strategy={verticalListSortingStrategy}
                    >
                      {teams.map((team) => (
                        <SortableRow key={team.id} team={team} isDragDisabled={selectedEvent?.status === 'completed'}>
                          <TableCell className="font-medium w-48">
                            <div className="truncate" title={team.name}>
                              {team.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground w-64">
                            <div className="truncate" title={team.description || ''}>
                              {team.description || '—'}
                            </div>
                          </TableCell>
                          <TableCell className="w-32">
                            <div className="flex gap-2">
                              {team.demoUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  className="h-8 w-8 p-0"
                                >
                                  <a href={team.demoUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              {team.repoUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  className="h-8 w-8 p-0"
                                >
                                  <a href={team.repoUrl} target="_blank" rel="noopener noreferrer">
                                    <Github className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="w-32">
                            <div className="flex gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDialog(team)}
                                      className="h-8 w-8 p-0"
                                      disabled={selectedEvent?.status === 'completed'}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                {selectedEvent?.status === 'completed' && (
                                  <TooltipContent>
                                    <p>Cannot edit teams in completed events</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                              <AlertDialog>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setTeamToDelete(team)}
                                          disabled={deletingTeams.has(team.id) || selectedEvent?.status === 'active' || selectedEvent?.status === 'completed'}
                                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 disabled:text-muted-foreground"
                                        >
                                          {deletingTeams.has(team.id) ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </AlertDialogTrigger>
                                    </div>
                                  </TooltipTrigger>
                                  {(selectedEvent?.status === 'active' || selectedEvent?.status === 'completed') && (
                                    <TooltipContent>
                                      <p>Cannot delete teams during or after event</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the team &quot;{team.name}&quot; and all associated scores.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setTeamToDelete(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Delete Team
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </SortableRow>
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  )
}