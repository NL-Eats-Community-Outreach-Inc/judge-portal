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
import { Save, Loader2, Plus, Edit2, Trash2, Calendar, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminCompetition } from '../contexts/admin-competition-context';
import JudgeAssignmentDialog from '@/components/judge-assignment-dialog';

interface Competition {
  id: string;
  name: string;
  description: string | null;
  status: 'setup' | 'open' | 'active' | 'completed';
  organizationId: string | null;
  maxTeamSize: number | null;
  prize: string | null;
  tags: string[] | null;
  submissionDeadline: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CompetitionManagement() {
  const { competitions, isLoading, refreshCompetitions } = useAdminCompetition();
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingCompetition, setDeletingCompetition] = useState<Competition | null>(null);
  const [judgeAssignmentDialog, setJudgeAssignmentDialog] = useState<{
    isOpen: boolean;
    competitionId: string | null;
    competitionName: string;
    competitionStatus: 'setup' | 'open' | 'active' | 'completed';
  }>({
    isOpen: false,
    competitionId: null,
    competitionName: '',
    competitionStatus: 'setup',
  });
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    status: 'setup' | 'open' | 'active' | 'completed';
    maxTeamSize: string;
    prize: string | null;
    tags: string[] | null;
    submissionDeadline: string | null;
    country: string | null;
  }>({
    name: '',
    description: '',
    status: 'setup',
    maxTeamSize: '',
    prize: '',
    tags: [],
    submissionDeadline: '',
    country: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'setup',
      maxTeamSize: '',
      prize: '',
      tags: [],
      submissionDeadline: '',
      country: '',
    });
    setEditingCompetition(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (competition: Competition) => {
    setEditingCompetition(competition);
    setFormData({
      name: competition.name,
      description: competition.description || '',
      status: competition.status,
      maxTeamSize: competition.maxTeamSize != null ? String(competition.maxTeamSize) : '',
      prize: competition.prize || '',
      tags: competition.tags || [],
      submissionDeadline: competition.submissionDeadline || '',
      country: competition.country || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Validation Error', {
        description: 'Competition name is required',
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
        prize: formData.prize || null,
        tags: formData.tags && formData.tags.length > 0 ? formData.tags : null,
        submissionDeadline: formData.submissionDeadline || null,
        country: formData.country || null,
      };

      let response;
      if (editingCompetition) {
        // Update existing competition
        response = await fetch(`/api/admin/competitions/${editingCompetition.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new competition
        response = await fetch('/api/admin/competition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save competition');
      }

      await response.json();

      // Refresh competitions list in context (this will update both CompetitionSelector and CompetitionManagement)
      await refreshCompetitions();

      // Close dialog and reset form
      setIsDialogOpen(false);
      resetForm();

      toast.success('Success', {
        description: editingCompetition
          ? 'Competition updated successfully'
          : 'Competition created successfully',
      });
    } catch (error) {
      console.error('Error saving competition:', error);
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to save competition',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCompetition) return;

    try {
      const response = await fetch(`/api/admin/competitions/${deletingCompetition.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete competition');
      }

      // Refresh competitions list in context (this will update both CompetitionSelector and CompetitionManagement)
      await refreshCompetitions();

      toast.success('Success', {
        description: 'Competition deleted successfully',
      });

      setDeletingCompetition(null);
    } catch (error) {
      console.error('Error deleting competition:', error);
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to delete competition',
      });
    }
  };

  const openJudgeAssignmentDialog = (competition: Competition) => {
    setJudgeAssignmentDialog({
      isOpen: true,
      competitionId: competition.id,
      competitionName: competition.name,
      competitionStatus: competition.status,
    });
  };

  const closeJudgeAssignmentDialog = () => {
    setJudgeAssignmentDialog({
      isOpen: false,
      competitionId: null,
      competitionName: '',
      competitionStatus: 'setup',
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
            <h2 className="text-2xl font-bold text-foreground">Competition Management</h2>
            <p className="text-muted-foreground">
              Manage your judging competitions and their status
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Competition
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCompetition ? 'Edit Competition' : 'Create New Competition'}
                </DialogTitle>
                <DialogDescription>
                  {editingCompetition
                    ? 'Update the competition details below.'
                    : 'Fill in the details to create a new judging competition.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="competition-name">Competition Name *</Label>
                  <Input
                    id="competition-name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter competition name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="competition-description">Description</Label>
                  <Textarea
                    id="competition-description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Enter competition description"
                    className="resize-none"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="competition-status">Status</Label>
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
                      <SelectItem value="setup">Setup - Preparing competition</SelectItem>
                      <SelectItem value="open">Open - Registration &amp; team forming</SelectItem>
                      <SelectItem value="active">Active - Judging in progress</SelectItem>
                      <SelectItem value="completed">Completed - Competition finished</SelectItem>
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

                <div className="space-y-2">
                  <Label htmlFor="competition-prize">Prize</Label>
                  <Input
                    id="competition-prize"
                    value={formData.prize || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, prize: e.target.value }))}
                    placeholder="e.g. $10 000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="competition-tags">Tags</Label>
                  <Input
                    id="competition-tags"
                    value={formData.tags?.join(', ')}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        tags: e.target.value
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean),
                      }))
                    }
                    placeholder="e.g. Sustainability, Design, Innovation"
                  />
                  <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="competition-submission-deadline">Submission Deadline</Label>
                  <Input
                    id="competition-submission-deadline"
                    type="datetime-local"
                    value={formData.submissionDeadline || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, submissionDeadline: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="competition-country">Country</Label>
                  <Input
                    id="competition-country"
                    value={formData.country || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                    placeholder="e.g. Canada"
                  />
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
                    {editingCompetition ? 'Update Competition' : 'Create Competition'}
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

        {/* Competitions List */}
        <Card
          className={`relative ${isRefreshing ? 'opacity-60' : ''} transition-opacity duration-200`}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>All Competitions</CardTitle>
                  <CardDescription>
                    Manage all your judging competitions ({competitions.length} total)
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    await refreshCompetitions();
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
            {competitions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p>No competitions yet</p>
                <p className="text-sm">Create your first judging competition to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {competitions.map((competition: Competition) => (
                  <Card key={competition.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              competition.status === 'active'
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : 'bg-muted'
                            }`}
                          >
                            <Calendar
                              className={`h-4 w-4 ${
                                competition.status === 'active'
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-foreground truncate">
                              {competition.name}
                            </h4>
                            <p className="text-sm text-muted-foreground truncate">
                              Created {new Date(competition.createdAt).toLocaleDateString()}
                              {competition.description && ` • ${competition.description}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {getStatusBadge(competition.status)}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openJudgeAssignmentDialog(competition)}
                              title="Manage Judge Assignments"
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(competition)}
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
                                        onClick={() => setDeletingCompetition(competition)}
                                        disabled={
                                          competition.status === 'open' ||
                                          competition.status === 'active' ||
                                          competition.status === 'completed'
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                  </div>
                                </TooltipTrigger>
                                {(competition.status === 'open' ||
                                  competition.status === 'active' ||
                                  competition.status === 'completed') && (
                                  <TooltipContent>
                                    <p>Cannot delete {competition.status} competitions</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the
                                    competition &quot;{competition.name}&quot; and all associated
                                    data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setDeletingCompetition(null)}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleDelete}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete Competition
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
            <span className="text-sm font-medium text-foreground">Refreshing competitions...</span>
          </div>
        </div>
      )}

      {/* Judge Assignment Dialog */}
      <JudgeAssignmentDialog
        eventId={judgeAssignmentDialog.competitionId}
        eventName={judgeAssignmentDialog.competitionName}
        eventStatus={judgeAssignmentDialog.competitionStatus}
        isOpen={judgeAssignmentDialog.isOpen}
        onOpenChange={closeJudgeAssignmentDialog}
        onAssignmentsUpdated={() => {
          toast.success('Judge assignments updated');
        }}
      />
    </TooltipProvider>
  );
}
