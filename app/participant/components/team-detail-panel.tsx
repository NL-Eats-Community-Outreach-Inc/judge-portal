'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Users,
  Crown,
  Copy,
  CheckCircle2,
  Lock,
  RefreshCw,
  LogOut,
  Trash2,
  Save,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { useParticipant } from '../contexts/participant-context';

interface TeamDetails {
  id: string;
  name: string;
  description: string | null;
  demoUrl: string | null;
  repoUrl: string | null;
  eventId: string;
  joinCode: string;
  presentationOrder: number;
  awardType: string;
  createdAt: string;
  eventName: string;
  eventStatus: string;
  maxTeamSize: number | null;
  isCreator: boolean;
  memberCount: number;
  hasSubmitted: boolean;
}

interface TeamMember {
  id: string;
  participantId: string;
  email: string;
  isCreator: boolean;
  joinedAt: string;
}

interface TeamDetailPanelProps {
  teamId: string;
}

export function TeamDetailPanel({ teamId }: TeamDetailPanelProps) {
  const router = useRouter();
  const { refreshAll } = useParticipant();

  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDemoUrl, setEditDemoUrl] = useState('');
  const [editRepoUrl, setEditRepoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Action states
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTeam = useCallback(async () => {
    setIsLoadingTeam(true);
    try {
      const response = await fetch(`/api/participant/teams/${teamId}`);
      const data = await response.json();
      if (response.ok) {
        setTeam(data.team);
        setEditName(data.team.name);
        setEditDescription(data.team.description || '');
        setEditDemoUrl(data.team.demoUrl || '');
        setEditRepoUrl(data.team.repoUrl || '');
      }
    } catch (error) {
      console.error('Error fetching team:', error);
    } finally {
      setIsLoadingTeam(false);
    }
  }, [teamId]);

  const fetchMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    try {
      const response = await fetch(`/api/participant/teams/${teamId}/members`);
      const data = await response.json();
      if (response.ok) {
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeam();
    fetchMembers();
  }, [fetchTeam, fetchMembers]);

  // Track changes
  useEffect(() => {
    if (!team) return;
    const changed =
      editName !== team.name ||
      editDescription !== (team.description || '') ||
      editDemoUrl !== (team.demoUrl || '') ||
      editRepoUrl !== (team.repoUrl || '');
    setHasChanges(changed);
  }, [editName, editDescription, editDemoUrl, editRepoUrl, team]);

  const isLocked = team?.eventStatus === 'active';
  const isResubmission = team?.eventStatus === 'open' && team?.hasSubmitted;
  const canSubmit = team?.eventStatus === 'open';

  const handleSave = async () => {
    if (!team || !hasChanges) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/participant/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          demoUrl: editDemoUrl.trim() || null,
          repoUrl: editRepoUrl.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save');
      setTeam(data.team);
      setHasChanges(false);
      toast.success('Team updated!');
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (!team) return;
    try {
      await navigator.clipboard.writeText(team.joinCode);
      setCopied(true);
      toast.success('Join code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const handleRegenerateCode = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/participant/teams/${teamId}/regenerate-code`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to regenerate');
      setTeam((prev) => (prev ? { ...prev, joinCode: data.joinCode } : null));
      toast.success('Join code regenerated!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleLeave = async () => {
    setIsLeaving(true);
    try {
      const response = await fetch(`/api/participant/teams/${teamId}/leave`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to leave team');
      toast.success(data.teamDeleted ? 'Team deleted (you were the last member)' : 'Left team');
      await refreshAll();
      router.push('/participant');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to leave team');
    } finally {
      setIsLeaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/participant/teams/${teamId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete team');
      }
      toast.success('Team deleted');
      await refreshAll();
      router.push('/participant');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete team');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async () => {
    if (!submissionText.trim()) {
      toast.error('Proposal cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: team?.id,
          submissionText: submissionText.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error_message || 'Submission failed');
      }

      toast.success(
        isResubmission ? 'Proposal resubmitted successfully!' : 'Proposal submitted successfully!'
      );
      setShowSubmit(false);
      setSubmissionText('');
      await fetchTeam();
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingTeam) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <Card className="p-6">
          <div className="h-6 w-32 bg-muted rounded mb-4" />
          <div className="h-12 w-full bg-muted rounded mb-4" />
          <div className="h-6 w-24 bg-muted rounded" />
        </Card>
        <Card className="p-6">
          <div className="h-6 w-28 bg-muted rounded mb-4" />
          <div className="space-y-3">
            <div className="h-10 w-full bg-muted rounded" />
            <div className="h-10 w-full bg-muted rounded" />
          </div>
        </Card>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Team not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Locked banner */}
      {isLocked && (
        <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Teams are locked during judging
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
              Your team information is read-only while judging is in progress.
            </p>
          </div>
        </div>
      )}

      {/* Team Header Card */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">{team.name}</h2>
              {team.isCreator && (
                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px]">
                  <Crown className="h-3 w-3 mr-1" />
                  Creator
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{team.eventName}</p>
            {team.description && (
              <p className="text-sm text-muted-foreground mt-2">{team.description}</p>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-end flex-1 gap-4 sm:gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Members</p>
              <p className="text-lg font-bold text-foreground">
                {team.memberCount}
                <span className="text-sm font-normal text-muted-foreground">
                  /{team.maxTeamSize || '\u221E'}
                </span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Presentation</p>
              <p className="text-lg font-bold text-foreground">#{team.presentationOrder}</p>
            </div>
          </div>
        </div>

        {/* Join code */}
        <div className="mt-4 flex items-center gap-2 sm:gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
          <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Join Code
          </span>
          <code className="text-base sm:text-lg font-mono font-bold tracking-[0.3em] text-foreground flex-1">
            {team.joinCode}
          </code>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-teal-500/10"
              onClick={handleCopyCode}
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            {!isLocked && team.isCreator && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-teal-500/10"
                onClick={handleRegenerateCode}
                disabled={isRegenerating}
              >
                <RefreshCw
                  className={`h-4 w-4 text-muted-foreground ${isRegenerating ? 'animate-spin' : ''}`}
                />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border/50 bg-muted/30 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Submit Proposal</h3>
              <p className="text-sm text-muted-foreground">
                Each team must submit one proposal before the event due date. Keep it concise and
                explain the problem, your solution, working features, business value, scalability,
                and technical implementation. Demo and repository URLs are also required in Team
                Details before the event due date.
              </p>
            </div>
            <Button
              onClick={() => setShowSubmit(true)}
              disabled={!canSubmit}
              className={`w-full sm:w-auto sm:flex-shrink-0 ${
                isResubmission
                  ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-md'
                  : canSubmit
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md'
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
              }`}
            >
              {isResubmission ? (
                'Resubmit'
              ) : team?.hasSubmitted ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Proposal Submitted
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Members Card */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-teal-500" />
          <h3 className="font-semibold text-foreground">Team Members</h3>
          <Badge variant="secondary" className="text-xs">
            {members.length}
          </Badge>
        </div>

        {isLoadingMembers ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-12 bg-muted rounded-lg" />
            <div className="h-12 bg-muted rounded-lg" />
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    {member.isCreator ? (
                      <Crown className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <Shield className="h-3.5 w-3.5 text-teal-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{member.email}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {member.isCreator && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 flex-shrink-0"
                  >
                    Creator
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Project Links & Edit Card */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <ExternalLink className="h-5 w-5 text-teal-500" />
          <h3 className="font-semibold text-foreground">Team Details</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Team Name</Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={isLocked}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">About</Label>
            <Textarea
              id="edit-description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              disabled={isLocked}
              rows={3}
              placeholder="Tell us about your team..."
              maxLength={500}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-demo">Demo URL</Label>
              <Input
                id="edit-demo"
                value={editDemoUrl}
                onChange={(e) => setEditDemoUrl(e.target.value)}
                disabled={isLocked}
                placeholder="https://..."
                type="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-repo">Repository URL</Label>
              <Input
                id="edit-repo"
                value={editRepoUrl}
                onChange={(e) => setEditRepoUrl(e.target.value)}
                disabled={isLocked}
                placeholder="https://github.com/..."
                type="url"
              />
            </div>
          </div>

          {!isLocked && hasChanges && (
            <div className="flex justify-end pt-2">
              <Button
                className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white"
                onClick={handleSave}
                disabled={isSaving || !editName.trim()}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* SUBMISSION PANEL */}
      <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Proposal</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              placeholder="Describe your proposal..."
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              rows={8}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowSubmit(false)}>
              Cancel
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={
                isResubmission
                  ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                  : 'bg-teal-600 hover:bg-teal-700 text-white'
              }
            >
              {isSubmitting ? 'Submitting...' : isResubmission ? 'Resubmit' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Actions Card - only when not locked */}
      {!isLocked && (
        <Card className="p-4 sm:p-6 border-destructive/20">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Team Actions</h3>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Leave Team */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave Team
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave Team?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {team.memberCount === 1
                      ? 'You are the last member. Leaving will permanently delete the team.'
                      : team.isCreator
                        ? 'As the creator, your role will transfer to the next member who joined.'
                        : "You can rejoin later using the team's join code."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLeave}
                    disabled={isLeaving}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {isLeaving ? 'Leaving...' : 'Leave Team'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Delete Team - creator only */}
            {team.isCreator && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Team
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Team?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the team and remove all members. This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-destructive hover:bg-destructive/90 text-white"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Team'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
