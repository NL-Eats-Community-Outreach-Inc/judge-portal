'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import {
  Save,
  Loader2,
  CheckCircle,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  RefreshCw,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminEvent } from '../contexts/admin-event-context';
import JudgeAssignmentDialog from '@/components/judge-assignment-dialog';

interface Event {
  id: string;
  name: string;
  description: string | null;
  status: 'setup' | 'active' | 'completed';
  registrationOpen: boolean;
  registrationCloseAt: string | null;
  maxTeamSize: number;
  createdAt: string;
  updatedAt: string;
}

export default function EventManagement() {
  const { events, isLoading, refreshEvents } = useAdminEvent();
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [judgeAssignmentDialog, setJudgeAssignmentDialog] = useState<{
    isOpen: boolean;
    eventId: string | null;
    eventName: string;
  }>({
    isOpen: false,
    eventId: null,
    eventName: '',
  });
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    status: 'setup' | 'active' | 'completed';
    registrationOpen: boolean;
    registrationCloseAt: Date | undefined;
    maxTeamSize: number;
  }>({
    name: '',
    description: '',
    status: 'setup',
    registrationOpen: false,
    registrationCloseAt: undefined,
    maxTeamSize: 5,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'setup',
      registrationOpen: false,
      registrationCloseAt: undefined,
      maxTeamSize: 5,
    });
    setEditingEvent(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      description: event.description || '',
      status: event.status,
      registrationOpen: event.registrationOpen,
      registrationCloseAt: event.registrationCloseAt
        ? new Date(event.registrationCloseAt)
        : undefined,
      maxTeamSize: event.maxTeamSize,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Validation Error', {
        description: 'Event name is required',
      });
      return;
    }

    // Validate registration settings
    if (formData.registrationCloseAt && formData.registrationCloseAt <= new Date()) {
      toast.error('Validation Error', {
        description: 'Registration close date must be in the future',
      });
      return;
    }

    if (formData.maxTeamSize < 1 || formData.maxTeamSize > 20) {
      toast.error('Validation Error', {
        description: 'Team size must be between 1 and 20',
      });
      return;
    }

    setIsSaving(true);
    try {
      const requestData = {
        ...formData,
        registrationCloseAt: formData.registrationCloseAt?.toISOString() || null,
      };

      let response;
      if (editingEvent) {
        // Update existing event
        response = await fetch(`/api/admin/events/${editingEvent.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });
      } else {
        // Create new event
        response = await fetch('/api/admin/event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save event');
      }

      await response.json();

      // Refresh events list in context (this will update both EventSelector and EventManagement)
      await refreshEvents();

      // Close dialog and reset form
      setIsDialogOpen(false);
      resetForm();

      toast.success('Success', {
        description: editingEvent ? 'Event updated successfully' : 'Event created successfully',
      });
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to save event',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingEvent) return;

    try {
      const response = await fetch(`/api/admin/events/${deletingEvent.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete event');
      }

      // Refresh events list in context (this will update both EventSelector and EventManagement)
      await refreshEvents();

      toast.success('Success', {
        description: 'Event deleted successfully',
      });

      setDeletingEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to delete event',
      });
    }
  };

  const openJudgeAssignmentDialog = (event: Event) => {
    setJudgeAssignmentDialog({
      isOpen: true,
      eventId: event.id,
      eventName: event.name,
    });
  };

  const closeJudgeAssignmentDialog = () => {
    setJudgeAssignmentDialog({
      isOpen: false,
      eventId: null,
      eventName: '',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      setup: 'outline',
      active: 'default',
      completed: 'secondary',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>;
  };

  const activeEvent = events.find((event) => event.status === 'active');

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
    <TooltipProvider>
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
                <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
                <DialogDescription>
                  {editingEvent
                    ? 'Update the event details below.'
                    : 'Fill in the details to create a new judging event.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="event-name">Event Name *</Label>
                  <Input
                    id="event-name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter event name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-description">Description</Label>
                  <Textarea
                    id="event-description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
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
                      setFormData((prev) => ({ ...prev, status: value }))
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
                  {formData.status === 'active' &&
                    activeEvent &&
                    activeEvent.id !== editingEvent?.id && (
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        Warning: Setting this event to active will deactivate &quot;
                        {activeEvent.name}&quot;
                      </p>
                    )}
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Participant Registration Settings
                  </h4>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="registration-open"
                        checked={formData.registrationOpen}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, registrationOpen: checked as boolean }))
                        }
                      />
                      <Label
                        htmlFor="registration-open"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Registration Open
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Allow participants to create and join teams
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registration-close">Registration Close Date (Optional)</Label>
                    <DateTimePicker
                      value={formData.registrationCloseAt}
                      onChange={(date) =>
                        setFormData((prev) => ({ ...prev, registrationCloseAt: date }))
                      }
                      placeholder="Select date and time"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to keep registration open indefinitely
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-team-size">Maximum Team Size</Label>
                    <Input
                      id="max-team-size"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.maxTeamSize}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          maxTeamSize: parseInt(e.target.value) || 5,
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of members allowed per team
                    </p>
                  </div>
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
                  <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-green-900 dark:text-green-100">
                      Active Event
                    </CardTitle>
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
                  <span className="font-medium text-green-900 dark:text-green-100">
                    Last Updated:
                  </span>
                  <p className="text-green-700 dark:text-green-300">
                    {new Date(activeEvent.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events List */}
        <Card
          className={`relative ${isRefreshing ? 'opacity-60' : ''} transition-opacity duration-200`}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>All Events</CardTitle>
                  <CardDescription>
                    Manage all your judging events ({events.length} total)
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    await refreshEvents();
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
            {events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p>No events yet</p>
                <p className="text-sm">Create your first judging event to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <Card key={event.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              event.status === 'active'
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : 'bg-muted'
                            }`}
                          >
                            <Calendar
                              className={`h-4 w-4 ${
                                event.status === 'active'
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-foreground truncate">{event.name}</h4>
                            <p className="text-sm text-muted-foreground truncate">
                              Created {new Date(event.createdAt).toLocaleDateString()}
                              {event.description && ` • ${event.description}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {getStatusBadge(event.status)}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openJudgeAssignmentDialog(event)}
                              title="Manage Judge Assignments"
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(event)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:text-destructive disabled:text-muted-foreground"
                                        onClick={() => setDeletingEvent(event)}
                                        disabled={
                                          event.status === 'active' || event.status === 'completed'
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                  </div>
                                </TooltipTrigger>
                                {(event.status === 'active' || event.status === 'completed') && (
                                  <TooltipContent>
                                    <p>Cannot delete {event.status} events</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the
                                    event &quot;{event.name}&quot; and all associated data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setDeletingEvent(null)}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleDelete}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
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

      {/* Subtle loading overlay */}
      {isRefreshing && (
        <div className="fixed inset-0 bg-background/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-background/95 backdrop-blur-md border border-border/50 rounded-lg px-6 py-4 shadow-lg flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">Refreshing events...</span>
          </div>
        </div>
      )}

      {/* Judge Assignment Dialog */}
      <JudgeAssignmentDialog
        eventId={judgeAssignmentDialog.eventId}
        eventName={judgeAssignmentDialog.eventName}
        isOpen={judgeAssignmentDialog.isOpen}
        onOpenChange={closeJudgeAssignmentDialog}
        onAssignmentsUpdated={() => {
          // Could refresh events if needed
          toast.success('Judge assignments updated');
        }}
      />
    </TooltipProvider>
  );
}
