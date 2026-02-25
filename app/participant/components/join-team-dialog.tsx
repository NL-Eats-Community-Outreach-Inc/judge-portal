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
import { Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

interface JoinTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function JoinTeamDialog({ open, onOpenChange, onSuccess }: JoinTeamDialogProps) {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) {
      setCode(value);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Join code must be exactly 6 characters');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/participant/teams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: code }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join team');
      }

      toast.success(`Joined team "${data.team.name}"!`);
      handleClose(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setCode('');
      setError(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center mb-1">
              <KeyRound className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <DialogTitle className="text-center">Join a Team</DialogTitle>
            <DialogDescription className="text-center">
              Enter the 6-character join code shared by your teammate.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <div className="space-y-2">
              <Label htmlFor="join-code" className="sr-only">
                Join Code
              </Label>
              <Input
                id="join-code"
                placeholder="XXXXXX"
                value={code}
                onChange={handleCodeChange}
                className="text-center text-2xl sm:text-3xl font-mono font-bold tracking-[0.4em] h-14 sm:h-16 uppercase"
                maxLength={6}
                autoFocus
                autoComplete="off"
              />
              {error && <p className="text-sm text-destructive text-center mt-2">{error}</p>}
              {!error && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {6 - code.length} character{6 - code.length !== 1 ? 's' : ''} remaining
                </p>
              )}
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
              className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white"
              disabled={isSubmitting || code.length !== 6}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Joining...
                </>
              ) : (
                'Join Team'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
