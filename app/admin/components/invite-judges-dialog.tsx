'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mail, Copy, Check, Info, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface InviteJudgesDialogProps {
  onInvitesSent?: () => void;
}

export function InviteJudgesDialog({ onInvitesSent }: InviteJudgesDialogProps) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<'admin' | 'judge' | 'participant'>('judge');
  const [customMessage, setCustomMessage] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [isLoading, setIsLoading] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<Array<{ email: string; inviteLink: string }>>([]);
  const [autoAddedEmails, setAutoAddedEmails] = useState<Array<{ email: string }>>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Parse emails (comma or newline separated)
      const emailList = emails
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      if (emailList.length === 0) {
        toast.error('Please enter at least one email address');
        return;
      }

      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: emailList,
          role,
          customMessage: customMessage || undefined,
          expiresInDays: parseInt(expiresInDays),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error('Failed to create invitations', {
          description: data.error || 'Please try again',
        });
        return;
      }

      // Capture auto-added judges
      const autoAdded: Array<{ email: string }> = data.autoAdded || [];
      if (autoAdded.length > 0) {
        setAutoAddedEmails(autoAdded);
      }

      // Handle results: invitations created and/or judges auto-added
      const hasInvitations = data.invitations && data.invitations.length > 0;
      const hasAutoAdded = autoAdded.length > 0;

      if (hasInvitations || hasAutoAdded) {
        if (hasInvitations) {
          setInviteLinks(data.invitations);
        }

        const parts: string[] = [];
        if (hasInvitations) {
          parts.push(`Created ${data.invitations.length} invitation(s)`);
        }
        if (hasAutoAdded) {
          parts.push(`${autoAdded.length} judge(s) added to your organization`);
        }
        if (data.existingInvites && data.existingInvites.length > 0) {
          parts.push(`${data.existingInvites.length} email(s) already had pending invitations`);
        }
        if (data.alreadyRegistered && data.alreadyRegistered.length > 0) {
          const registeredList = data.alreadyRegistered
            .map((u: { email: string; role: string }) => `${u.email} (${u.role})`)
            .join(', ');
          parts.push(
            `${data.alreadyRegistered.length} user(s) already registered: ${registeredList}`
          );
        }

        toast.success('Done!', {
          description: parts.join('. '),
          duration: 8000,
        });
      } else {
        // No invitations created and no auto-adds — all emails were filtered out
        const warnings: string[] = [];
        if (data.existingInvites && data.existingInvites.length > 0) {
          warnings.push(`${data.existingInvites.length} email(s) already have pending invitations`);
        }
        if (data.alreadyRegistered && data.alreadyRegistered.length > 0) {
          const registeredList = data.alreadyRegistered
            .map((u: { email: string; role: string }) => `${u.email} (${u.role})`)
            .join(', ');
          warnings.push(
            `${data.alreadyRegistered.length} user(s) already registered: ${registeredList}`
          );
        }

        toast.warning('No new invitations created', {
          description: warnings.join('. '),
          duration: 8000,
        });
        setOpen(false);
        return;
      }

      onInvitesSent?.();
    } catch {
      toast.error('Something went wrong', {
        description: 'Please try again later',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async (link: string, index: number) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedIndex(index);
      toast.success('Link copied!');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleReset = () => {
    setEmails('');
    setRole('judge');
    setCustomMessage('');
    setExpiresInDays('7');
    setInviteLinks([]);
    setAutoAddedEmails([]);
    setCopiedIndex(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    // Reset state when dialog is closed
    if (!newOpen) {
      handleReset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Mail className="mr-2 h-4 w-4" />
          Invite Users
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite Users</DialogTitle>
          <DialogDescription>
            Send invitation links via email. Invitees will be able to register without creating a
            password.
          </DialogDescription>
        </DialogHeader>

        {inviteLinks.length > 0 || autoAddedEmails.length > 0 ? (
          <div className="space-y-4">
            {/* Auto-added judges section (blue) */}
            {autoAddedEmails.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                    Added to your organization
                  </h4>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Already registered — added directly without invitation
                </p>
                <div className="mt-2 space-y-1">
                  {autoAddedEmails.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200"
                    >
                      <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span>{item.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invitation links section (green) */}
            {inviteLinks.length > 0 && (
              <>
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                  <h4 className="font-semibold text-green-900 dark:text-green-100">
                    Invitations Created!
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Share these links with the invitees
                  </p>
                </div>

                <div className="space-y-2">
                  {inviteLinks.map((invite, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-3 rounded-lg border bg-muted"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{invite.email}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {invite.inviteLink}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyLink(invite.inviteLink, index)}
                      >
                        {copiedIndex === index ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  handleReset();
                  // Keep dialog open to create more invitations
                }}
                className="flex-1"
              >
                Invite More
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emails">Email Addresses *</Label>
              <Textarea
                id="emails"
                placeholder="judge1@example.com, judge2@example.com&#10;Or one email per line"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                required
                disabled={isLoading}
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple emails with commas or new lines
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as 'admin' | 'judge' | 'participant')}
                disabled={isLoading}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="judge">Judge</SelectItem>
                  <SelectItem value="participant">Participant</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {role === 'admin' && (
                <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2.5 dark:border-blue-800 dark:bg-blue-950">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Admin users will be assigned to your organization with full management access.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">Expires In</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays} disabled={isLoading}>
                <SelectTrigger id="expires">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days (recommended)</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Custom Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a personal message to the invitation email..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Sending...' : 'Send Invitations'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
