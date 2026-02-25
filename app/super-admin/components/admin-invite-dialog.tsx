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
import { Loader2, Mail, Copy, Check, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface AdminInviteDialogProps {
  orgId: string;
  orgName: string;
  onInviteSent?: () => void;
}

export function AdminInviteDialog({ orgId, orgName, onInviteSent }: AdminInviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [isLoading, setIsLoading] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<Array<{ email: string; inviteLink: string }>>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const emailList = emails
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      if (emailList.length === 0) {
        toast.error('Please enter at least one email address');
        return;
      }

      const response = await fetch(`/api/super-admin/organizations/${orgId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: emailList,
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

      if (data.invitations && data.invitations.length > 0) {
        setInviteLinks(data.invitations);

        const warnings: string[] = [];
        if (data.existingInvites?.length > 0) {
          warnings.push(`${data.existingInvites.length} email(s) already had pending invitations`);
        }
        if (data.alreadyRegistered?.length > 0) {
          warnings.push(`${data.alreadyRegistered.length} user(s) already registered`);
        }

        toast.success('Admin invitations sent!', {
          description:
            warnings.length > 0
              ? `Created ${data.invitations.length} invitation(s). ${warnings.join('. ')}`
              : `Created ${data.invitations.length} invitation(s) for ${orgName}`,
          duration: 8000,
        });
      } else {
        toast.warning('No new invitations created', {
          description: 'All emails are already invited or registered',
          duration: 8000,
        });
        setOpen(false);
        return;
      }

      onInviteSent?.();
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
    setCustomMessage('');
    setExpiresInDays('7');
    setInviteLinks([]);
    setCopiedIndex(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      handleReset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="flex items-center gap-1">
          <UserPlus className="h-3.5 w-3.5" />
          Invite Admin
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite Admin to {orgName}</DialogTitle>
          <DialogDescription>
            Send invitation links to admins. They&apos;ll be assigned to this organization upon
            registration.
          </DialogDescription>
        </DialogHeader>

        {inviteLinks.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
              <h4 className="font-semibold text-green-900 dark:text-green-100">
                Invitations Created!
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Share these links with the admins for {orgName}
              </p>
            </div>

            <div className="space-y-2">
              {inviteLinks.map((invite, index) => (
                <div key={index} className="flex items-center gap-2 p-3 rounded-lg border bg-muted">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{invite.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{invite.inviteLink}</p>
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

            <div className="flex gap-2">
              <Button onClick={handleReset} className="flex-1">
                Invite More Admins
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-emails">Email Addresses *</Label>
              <Textarea
                id="admin-emails"
                placeholder="admin@example.com&#10;Or separate with commas"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                required
                disabled={isLoading}
                rows={3}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple emails with commas or new lines
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-expires">Expires In</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays} disabled={isLoading}>
                <SelectTrigger id="admin-expires">
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
              <Label htmlFor="admin-message">Custom Message (optional)</Label>
              <Textarea
                id="admin-message"
                placeholder="Add a personal message..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                disabled={isLoading}
                rows={2}
              />
            </div>

            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/50">
              <p className="text-xs text-violet-700 dark:text-violet-300">
                <Mail className="h-3.5 w-3.5 inline mr-1" />
                Invited admins will be assigned to <strong>{orgName}</strong> upon registration.
              </p>
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
