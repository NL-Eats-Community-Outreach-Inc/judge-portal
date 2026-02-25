'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Copy, CheckCircle2, Rocket, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface CreateTeamDialogProps {
  eventId: string;
  eventName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateTeamDialog({
  eventId,
  eventName,
  open,
  onOpenChange,
  onSuccess,
}: CreateTeamDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdJoinCode, setCreatedJoinCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/participant/teams/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create team');
      }

      setCreatedJoinCode(data.team.joinCode);
      toast.success(`Team "${data.team.name}" created!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!createdJoinCode) return;
    try {
      await navigator.clipboard.writeText(createdJoinCode);
      setCopied(true);
      toast.success('Join code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      if (createdJoinCode) {
        onSuccess();
      }
      // Reset state
      setName('');
      setDescription('');
      setCreatedJoinCode(null);
      setCopied(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {createdJoinCode ? (
          // Success state - show join code
          <>
            <DialogHeader>
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-2">
                <Sparkles className="h-7 w-7 text-emerald-500" />
              </div>
              <DialogTitle className="text-center">Team Created!</DialogTitle>
              <DialogDescription className="text-center">
                Share this join code with your teammates so they can join your team.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-full p-4 rounded-xl bg-muted/50 border border-border/50 text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Join Code
                </p>
                <div className="flex items-center justify-center gap-3">
                  <code className="text-3xl sm:text-4xl font-mono font-bold tracking-[0.3em] text-foreground">
                    {createdJoinCode}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 hover:bg-teal-500/10"
                    onClick={handleCopyCode}
                  >
                    {copied ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Copy className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                Your teammates can enter this code on the event page to join your team.
              </p>
            </div>

            <DialogFooter>
              <Button
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white"
                onClick={() => handleClose(false)}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Form state
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center mb-1">
                <Rocket className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <DialogTitle className="text-center">Create a Team</DialogTitle>
              <DialogDescription className="text-center">
                For <span className="font-medium text-foreground">{eventName}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name *</Label>
                <Input
                  id="team-name"
                  placeholder="e.g., Team Alpha"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-description">Description (optional)</Label>
                <Textarea
                  id="team-description"
                  placeholder="Describe your project idea..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white"
                disabled={isSubmitting || !name.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Team'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
