'use client';

import { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, Plus, Edit2, Trash2, Calendar, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminEvent } from '../contexts/admin-event-context';
import JudgeAssignmentDialog from '@/components/judge-assignment-dialog';

interface Event {
  id: string;
  name: string;
  description: string | null;
  status: 'setup' | 'open' | 'active' | 'completed';
  organizationId: string | null;
  maxTeamSize: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Competition {
  id: string;
  eventId: string;
  title: string | null;
  shortDescription: string | null;
  coverImageUrl: string | null;
  challengeType: string | null;
  tags: string[] | null;
  prize: string | null;
  deadline: string | null;
  country: string | null;
  participantSignupUrl: string | null;
}

export default function EventManagement() {
  const { events, isLoading, refreshEvents } = useAdminEvent();
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);

  //Competitions stored as a dictionary keyed eventId so we can check if an event has a competition wihout looping through array
  const [competitions, setCompetitions] = useState<Record<string, Competition>>({});

  // Tracks whether the "Promote to competiton" toggle is on or off
  const [isCompetition, setIsCompetition] = useState(false);
  const [competitionFormData, setCompetitionFormData] = useState<{
    title: string;
    shortDescription: string;
    coverImageUrl: string;
    challengeType: string;
    tags: string;
    prize: string;
    deadline: string;
    country: string;
    participantSignupUrl: string;
  }>({
    title: '',
    shortDescription: '',
    coverImageUrl: '',
    challengeType: 'global',
    tags: '',
    prize: '',
    deadline: '',
    country: '',
    participantSignupUrl: '',
  });
  const [judgeAssignmentDialog, setJudgeAssignmentDialog] = useState<{
    isOpen: boolean;
    eventId: string | null;
    eventName: string;
    eventStatus: 'setup' | 'open' | 'active' | 'completed';
  }>({
    isOpen: false,
    eventId: null,
    eventName: '',
    eventStatus: 'setup',
  });
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    status: 'setup' | 'open' | 'active' | 'completed';
    maxTeamSize: string;
  }>({
    name: '',
    description: '',
    status: 'setup',
    maxTeamSize: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'setup',
      maxTeamSize: '',
    });
    setIsCompetition(false);
    setCompetitionFormData({
      title: '',
      shortDescription: '',
      coverImageUrl: '',
      challengeType: 'global',
      tags: '',
      prize: '',
      deadline: '',
      country: '',
      participantSignupUrl: '',
    });
    setEditingEvent(null);
  };

  const fetchCompetitions = async () => {
    try {
      const response = await fetch('/api/admin/competitions');
      if (response.ok) {
        const data = await response.json();

        // Convert the list into a dictionary keyed by eventId so its easier to look up competitions by event later
        const map: Record<string, Competition> = {};
        data.forEach((c: Competition) => {
          map[c.eventId] = c;
        });
        setCompetitions(map);
      }
    } catch (error) {
      console.error('Error fetching competitions', error);
    }
  };

  // Render competitions when the page first opens
  useEffect(() => {
    fetchCompetitions();
  }, []);

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
      maxTeamSize: event.maxTeamSize != null ? String(event.maxTeamSize) : '',
    });

    //If this event already has a competition, turn toggle on, and fill fields
    const existing = competitions[event.id];
    if (existing) {
      setIsCompetition(true);
      setCompetitionFormData({
        title: existing.title || '',
        shortDescription: existing.shortDescription || '',
        coverImageUrl: existing.coverImageUrl || '',
        challengeType: existing.challengeType || 'global',
        tags: existing.tags?.join(', ') || '', //Tags come back as an array from db, join them as a comma seperated string
        prize: existing.prize || '',
        deadline: existing.deadline ? existing.deadline.slice(0, 16) : '', // Slices ISO deadline to the YYYY-MM-DDTHH:mm datetime-local format
        country: existing.country || '',
        participantSignupUrl: existing.participantSignupUrl || '',
      });
    }

    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Validation Error', {
        description: 'Event name is required',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        status: formData.status,
        maxTeamSize: formData.maxTeamSize ? parseInt(formData.maxTeamSize, 10) : null,
      };

      let response;
      if (editingEvent) {
        // Update existing event
        response = await fetch(`/api/admin/events/${editingEvent.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new event
        response = await fetch('/api/admin/event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save event');
      }

      const { event: savedEvent } = await response.json();

      // If edting we already have eventId, if creating event then we use the one returned from the API
      const eventId = editingEvent ? editingEvent.id : savedEvent.id;

      // Build the competition payload from the form converting tags back to an array
      const competitionPayload = {
        eventId,
        title: competitionFormData.title || null,
        shortDescription: competitionFormData.shortDescription || null,
        coverImageUrl: competitionFormData.coverImageUrl || null,
        challengeType: competitionFormData.challengeType,
        tags: competitionFormData.tags
          ? competitionFormData.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : null,
        prize: competitionFormData.prize || null,
        deadline: competitionFormData.deadline || null,
        country: competitionFormData.country || null,
        participantSignupUrl: competitionFormData.participantSignupUrl || null,
      };

      const existing = competitions[eventId];

      if (isCompetition) {
        // Toggle is on -> create or update the competition record
        if (existing) {
          // Competition already exists, update it
          await fetch(`/api/admin/competitions/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(competitionPayload),
          });
        } else {
          // No competition yet, create one linked to this event
          await fetch('/api/admin/competitions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(competitionPayload),
          });
        }
      } else if (!isCompetition && existing) {
        // Toggle is off but a competiiton record exists - remove it
        await fetch(`/api/admin/competitions/${existing.id}`, {
          method: 'DELETE',
        });
      }

      // Refresh events and competitions list in context (this will update both EventSelector and EventManagement)
      await refreshEvents();
      await fetchCompetitions();

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
      eventStatus: event.status,
    });
  };

  const closeJudgeAssignmentDialog = () => {
    setJudgeAssignmentDialog({
      isOpen: false,
      eventId: null,
      eventName: '',
      eventStatus: 'setup',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      setup: 'outline',
      open: 'secondary',
      active: 'default',
      completed: 'secondary',
    };
    const labels: Record<string, string> = {
      setup: 'SETUP',
      open: 'OPEN',
      active: 'ACTIVE',
      completed: 'COMPLETED',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status.toUpperCase()}
      </Badge>
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
            <DialogContent className="overflow-y-auto max-h-[80vh]">
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
                    onValueChange={(value: 'setup' | 'open' | 'active' | 'completed') =>
                      setFormData((prev) => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="setup">Setup - Preparing event</SelectItem>
                      <SelectItem value="open">Open - Registration &amp; team forming</SelectItem>
                      <SelectItem value="active">Active - Judging in progress</SelectItem>
                      <SelectItem value="completed">Completed - Event finished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-team-size">Max Team Size</Label>
                  <Input
                    id="max-team-size"
                    type="number"
                    min="1"
                    value={formData.maxTeamSize}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, maxTeamSize: e.target.value }))
                    }
                    placeholder="No limit"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of members per team. Leave empty for no limit.
                  </p>
                </div>

                {/* Divider and toggle to promote this event to a competition */}
                <div className="border-t border-border/50 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Promote to Competition</p>
                      <p className="text-xs text-muted-foreground">
                        Adds extra details like prize, tags, and deadline for the participant view.
                      </p>
                    </div>
                    {/* Toggle switch - clickting it flips isCompetiton between true and false */}
                    <Switch
                      checked={isCompetition}
                      onCheckedChange={(checked) => setIsCompetition(checked)}
                    />
                  </div>

                  {/* Competition fields - only visible when the toggle is on */}
                  {isCompetition && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="competition-title">Title</Label>
                        <Input
                          id="competition-title"
                          value={competitionFormData.title}
                          onChange={(e) =>
                            setCompetitionFormData((prev) => ({ ...prev, title: e.target.value }))
                          }
                          placeholder="Competition title"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="competition-prize">Prize</Label>
                        <Input
                          id="competition-prize"
                          value={competitionFormData.prize}
                          onChange={(e) =>
                            setCompetitionFormData((prev) => ({ ...prev, prize: e.target.value }))
                          }
                          placeholder="e.g. $10,000"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="competition-country">Country</Label>
                        <Input
                          id="competition-country"
                          value={competitionFormData.country}
                          onChange={(e) =>
                            setCompetitionFormData((prev) => ({ ...prev, country: e.target.value }))
                          }
                          placeholder="e.g. Canada"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="competition-deadline">Deadline</Label>
                        <Input
                          id="competition-deadline"
                          type="datetime-local"
                          value={competitionFormData.deadline}
                          onChange={(e) =>
                            setCompetitionFormData((prev) => ({
                              ...prev,
                              deadline: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1 col-span-2">
                        <Label htmlFor="competition-tags">Tags</Label>
                        <Input
                          id="competition-tags"
                          value={competitionFormData.tags}
                          onChange={(e) =>
                            setCompetitionFormData((prev) => ({ ...prev, tags: e.target.value }))
                          }
                          placeholder="e.g. Sustainability, Design"
                        />
                        <p className="text-xs text-muted-foreground">Seperate tags with commas.</p>
                      </div>

                      <div className="space-y-1 col-span-2">
                        <Label htmlFor="competition-shortDescription">Short Description</Label>
                        <Textarea
                          id="competition-shortDescription"
                          value={competitionFormData.shortDescription}
                          onChange={(e) =>
                            setCompetitionFormData((prev) => ({
                              ...prev,
                              shortDescription: e.target.value,
                            }))
                          }
                          placeholder="Brief public-facing description"
                          rows={2}
                          className="resize-none"
                        />
                      </div>

                      <div className="space-y-1 col-span-2">
                        <Label htmlFor="competition-participantSignupUrl">
                          Participant Signup Url
                        </Label>
                        <Input
                          id="competition-participantSignupUrl"
                          value={competitionFormData.participantSignupUrl}
                          onChange={(e) =>
                            setCompetitionFormData((prev) => ({
                              ...prev,
                              participantSignupUrl: e.target.value,
                            }))
                          }
                          placeholder="https://..."
                        />
                      </div>
                    </div>
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
                                        className="text-red-600 hover:text-red-700 disabled:text-muted-foreground"
                                        onClick={() => setDeletingEvent(event)}
                                        disabled={
                                          event.status === 'open' ||
                                          event.status === 'active' ||
                                          event.status === 'completed'
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                  </div>
                                </TooltipTrigger>
                                {(event.status === 'open' ||
                                  event.status === 'active' ||
                                  event.status === 'completed') && (
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
        eventStatus={judgeAssignmentDialog.eventStatus}
        isOpen={judgeAssignmentDialog.isOpen}
        onOpenChange={closeJudgeAssignmentDialog}
        onAssignmentsUpdated={() => {
          toast.success('Judge assignments updated');
        }}
      />
    </TooltipProvider>
  );
}
