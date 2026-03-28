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
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip';
import {
  Save,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Rocket,
  Trophy,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAdminEvent } from '../contexts/admin-event-context';

export default function ChallengeManagement() {
  const { events: availableEvents } = useAdminEvent();

  const [challenges, setChallenges] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<any | null>(null);
  const [deletingChallenge, setDeletingChallenge] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    status: 'setup',
    challengeType: 'local',
    title: '',
    eventId: '',
    deadline: '',
    description: '',
    shortDescription: '',
    coverImageUrl: '',
    prize: '',
    maxTeams: '100',
    tags: [] as string[],
  });

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/challenges');
      if (!response.ok) throw new Error('Failed to fetch challenges');

      const data = await response.json();
      setChallenges(data.challenges || data || []);
    } catch (error) {
      toast.error('Error', { description: 'Failed to load challenges' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormData({
      status: 'setup',
      challengeType: 'local',
      title: '',
      eventId: '',
      deadline: '',
      description: '',
      shortDescription: '',
      coverImageUrl: '',
      prize: '',
      maxTeams: '100',
      tags: [],
    });
    setEditingChallenge(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (challenge: any) => {
    setEditingChallenge(challenge);
    const formattedDate = challenge.deadline
      ? new Date(challenge.deadline).toISOString().slice(0, 16)
      : '';

    setFormData({
      eventId: challenge.eventId || challenge.id,
      title: challenge.title || '',
      description: challenge.description || '',
      deadline: formattedDate,
      status: challenge.status || 'setup',
      coverImageUrl: challenge.coverImageUrl || challenge.cover_image_url || '',
      challengeType: challenge.challengeType || challenge.challenge_type || 'global',
      prize: challenge.prize || challenge.prize_amount || '',
      maxTeams: challenge.maxTeams != null ? String(challenge.maxTeams) : '100',
      tags: challenge.tags || [],
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.eventId.trim() || !formData.deadline) {
      toast.error('Validation Error', {
        description: 'Title, Linked Event, and Deadline are required',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        maxTeams: formData.maxTeams ? parseInt(formData.maxTeam, 10) : null,
      };

      let response;
      if(editingChallenge){
        // update existing challenge
        response = await fetch(`/api/admin/challenges/${editingChallenge.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }else{
      // create new challenge
        response = await fetch('/api/admin/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) throw new Error('API routing failed');
      toast.success('Success', {
        description: 'Innovation Challenges updated',
      });
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Save Failed', { description: 'Failed to save challenge' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingChallenge) return;
    try {
      const response = await fetch(`/api/admin/challenges/${deletingChallenge.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      toast.success('Deleted', { description: 'Challenge removed successfully' });
      setDeletingChallenge(null);
      fetchData();
    } catch (error) {
      toast.error('Error', { description: 'Note: DELETE API may not be merged yet' });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      setup: 'outline',
      open: 'secondary',
      active: 'default',
      completed: 'secondary',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>;
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Innovation Challenges</h2>
            <p className="text-muted-foreground">Manage your innovation challenges</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Create Challenge
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingChallenge ? 'Edit Challenge' : 'Create New Challenge'}
                </DialogTitle>
                <DialogDescription>
                  Enter information to create a new challenge
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Event *</Label>
                    <Select
                      disabled={!!editingChallenge}
                      onValueChange={(val) => setFormData((prev) => ({ ...prev, eventId: val }))}
                      value={formData.eventId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Event" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEvents.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Challenge Title *</Label>
                  <Input 
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter public name" 
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Deadline *</Label>
                    <Input 
                      type="datetime-local" 
                      value={formData.deadline}
                      onChange={(e) => setFormData((prev) => ({ ...prev, deadline: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status *</Label>
                    <Select
                      onValueChange={(val) => setFormData((prev) => ({ ...prev, status: val }))}
                      value={formData.status}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="setup">Draft</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Short Description</Label>
                  <Input 
                    value={formData.shortDescription}
                    onChange={(e) => setFormData((prev) => ({ ...prev, shortDescription: e.target.value }))}
                    placeholder="Description" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prize Amount</Label>
                    <div className="relative">
                      <Trophy className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={formData.prize}
                        onChange={(e) => setFormData((prev) => ({ ...prev, prize: e.target.value }))}
                        placeholder="Prize description"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Teams</Label>
                    <div className="relative">
                      <Users className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="number" 
                        value={formData.maxTeams}
                        onChange={(e) => setFormData((prev) => ({ ...prev, maxTeams: e.target.value }))}
                        className="pl-9" 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cover Image URL</Label>
                  <Input
                    type="url"
                    placeholder="https://example.com/image.png"
                    value={formData.coverImageUrl}
                    onChange={(e) => setFormData((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
                  />
                  {formData.coverImageUrl && (
                    <img
                      src={formData.coverImageUrl}
                      alt="Preview"
                      className="mt-2 h-32 w-full object-cover rounded-md border"
                    />
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {editingChallenge ? 'Update Challenge' : 'Create Challenge'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className={isRefreshing ? 'opacity-60' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Rocket className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Innovation Challenges</CardTitle>
                  <CardDescription>Existing Innovation Challenges</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchData} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {challenges.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Rocket className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p>No challenges found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {challenges.map((challenge, i) => (
                  <Card key={challenge.id || i} className="border-border/50">
                    <div className="flex items-center p-4 gap-4">
                      <div className="h-14 w-20 bg-muted rounded overflow-hidden flex-shrink-0 border">
                        {challenge.coverImageUrl || challenge.cover_image_url ? (
                          <img
                            src={challenge.coverImageUrl || challenge.cover_image_url}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Rocket className="h-5 w-5 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold truncate">{challenge.title}</h4>
                          {getStatusBadge(challenge.status ?? 'setup')}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Ends:{' '}
                          {challenge.deadline
                            ? new Date(challenge.deadline).toLocaleDateString()
                            : 'N/A'}{' '}
                          • Event: {challenge.eventName || 'Linked Event'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(challenge)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-500"
                              onClick={() => setDeletingChallenge(challenge)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete challenge?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone and will remove the public listing.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setDeletingChallenge(null)}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleDelete}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}