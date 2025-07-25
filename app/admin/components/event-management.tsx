'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Save, Loader2, CheckCircle, Settings, Plus, Edit2, Trash2, Calendar } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useAdminEvent } from '../contexts/admin-event-context'

interface Event {
  id: string
  name: string
  description: string | null
  status: 'setup' | 'active' | 'completed'
  createdAt: string
  updatedAt: string
}

export default function EventManagement() {
  const { events, isLoading, refreshEvents } = useAdminEvent()
  const [isSaving, setIsSaving] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'setup' as const
  })
  const { toast } = useToast()

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'setup'
    })
    setEditingEvent(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (event: Event) => {
    setEditingEvent(event)
    setFormData({
      name: event.name,
      description: event.description || '',
      status: event.status
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Event name is required',
        variant: 'destructive'
      })
      return
    }

    setIsSaving(true)
    try {
      let response
      if (editingEvent) {
        // Update existing event
        response = await fetch(`/api/admin/events/${editingEvent.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        })
      } else {
        // Create new event
        response = await fetch('/api/admin/event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        })
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save event')
      }

      const data = await response.json()
      
      // Refresh events list in context (this will update both EventSelector and EventManagement)
      await refreshEvents()
      
      // Close dialog and reset form
      setIsDialogOpen(false)
      resetForm()
      
      toast({
        title: 'Success',
        description: editingEvent ? 'Event updated successfully' : 'Event created successfully'
      })
    } catch (error) {
      console.error('Error saving event:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save event',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingEvent) return
    
    try {
      const response = await fetch(`/api/admin/events/${deletingEvent.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete event')
      }

      // Refresh events list in context (this will update both EventSelector and EventManagement)
      await refreshEvents()
      
      toast({
        title: 'Success',
        description: 'Event deleted successfully'
      })
      
      setDeletingEvent(null)
    } catch (error) {
      console.error('Error deleting event:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete event',
        variant: 'destructive'
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      setup: 'outline',
      active: 'default',
      completed: 'secondary'
    }
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>
  }

  const activeEvent = events.find(event => event.status === 'active')

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
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Event Management</h2>
          <p className="text-muted-foreground">Manage your judging events and their status</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </DialogTitle>
              <DialogDescription>
                {editingEvent ? 'Update the event details below.' : 'Fill in the details to create a new judging event.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event-name">Event Name *</Label>
                <Input
                  id="event-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter event name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-description">Description</Label>
                <Textarea
                  id="event-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter event description"
                  className="resize-none"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'setup' | 'active' | 'completed') => 
                    setFormData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="setup">Setup - Preparing event</SelectItem>
                    <SelectItem value="active">Active - Judging in progress</SelectItem>
                    <SelectItem value="completed">Completed - Event finished</SelectItem>
                  </SelectContent>
                </Select>
                {formData.status === 'active' && activeEvent && activeEvent.id !== editingEvent?.id && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Warning: Setting this event to active will deactivate "{activeEvent.name}"
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Event Card */}
      {activeEvent && (
        <Card className="bg-gradient-to-r from-green-50/50 to-emerald-50/30 dark:from-green-800/20 dark:to-emerald-900/10 border-green-200 dark:border-green-800 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-green-900 dark:text-green-100">Active Event</CardTitle>
                  <CardDescription className="text-green-700 dark:text-green-300">
                    {activeEvent.name}
                  </CardDescription>
                </div>
              </div>
              {getStatusBadge(activeEvent.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-green-900 dark:text-green-100">Created:</span>
                <p className="text-green-700 dark:text-green-300">
                  {new Date(activeEvent.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="font-medium text-green-900 dark:text-green-100">Last Updated:</span>
                <p className="text-green-700 dark:text-green-300">
                  {new Date(activeEvent.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>All Events</CardTitle>
              <CardDescription>
                Manage all your judging events ({events.length} total)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-foreground mb-2">No events yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create your first judging event to get started
              </p>
              <Button onClick={openCreateDialog} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create First Event
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <Card key={event.id} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          event.status === 'active' 
                            ? 'bg-green-100 dark:bg-green-900/30' 
                            : 'bg-muted'
                        }`}>
                          <Calendar className={`h-4 w-4 ${
                            event.status === 'active' 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{event.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Created {new Date(event.createdAt).toLocaleDateString()}
                            {event.description && ` • ${event.description}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(event.status)}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(event)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeletingEvent(event)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the event "{event.name}" and all associated data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setDeletingEvent(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete Event
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}