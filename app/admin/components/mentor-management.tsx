'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  Loader2,
  Users,
  Clock,
  CheckCircle2,
  Check,
  X,
  RefreshCw,
  Linkedin,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

interface MentorProfile {
  id: string;
  learnworldsUserId: string;
  fullName: string;
  title: string | null;
  organization: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  calendlyUrl: string | null;
  photoUrl: string | null;
  tags: string[] | null;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function MentorManagement() {
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingIds, setUpdatingIds] = useState(new Set<string>());

  const fetchMentors = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/mentors');
      const data = await response.json();

      if (response.ok) {
        setMentors(data.mentors);
      } else {
        throw new Error(data.error || 'Failed to load mentors');
      }
    } catch (error) {
      console.error('Error fetching mentors:', error);
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to load mentors',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  const setVisibility = async (mentorId: string, isVisible: boolean) => {
    setUpdatingIds((prev) => new Set(prev).add(mentorId));

    try {
      const response = await fetch(`/api/admin/mentors/${mentorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update mentor');
      }

      const data = await response.json();
      setMentors((prev) => prev.map((m) => (m.id === mentorId ? data.mentor : m)));

      toast.success(isVisible ? 'Mentor approved' : 'Mentor hidden', {
        description: isVisible
          ? 'Profile is now visible in the public directory.'
          : 'Profile is now hidden from the public directory.',
      });
    } catch (error) {
      console.error('Error updating mentor:', error);
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to update mentor',
      });
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(mentorId);
        return next;
      });
    }
  };

  const pendingMentors = mentors.filter((m) => !m.isVisible);
  const approvedMentors = mentors.filter((m) => m.isVisible);

  const getStatsCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardContent className="flex items-center p-6">
          <div className="flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg mr-4 shadow-sm">
            <Users className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{mentors.length}</p>
            <p className="text-muted-foreground text-sm">Total Mentors</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center p-6">
          <div className="flex items-center justify-center w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg mr-4 shadow-sm">
            <Clock className="h-6 w-6 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{pendingMentors.length}</p>
            <p className="text-muted-foreground text-sm">Pending Review</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center p-6">
          <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg mr-4 shadow-sm">
            <CheckCircle2 className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{approvedMentors.length}</p>
            <p className="text-muted-foreground text-sm">Approved</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderMentorTable = (rows: MentorProfile[], kind: 'pending' | 'approved') => {
    if (rows.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">
            {kind === 'pending' ? 'No mentors waiting for review' : 'No approved mentors yet'}
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Title / Organization</TableHead>
              <TableHead>Bio</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((mentor) => {
              const busy = updatingIds.has(mentor.id);
              return (
                <TableRow key={mentor.id}>
                  <TableCell className="align-middle">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{mentor.fullName}</span>
                      {mentor.linkedinUrl && (
                        <a
                          href={mentor.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Verify on LinkedIn"
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Linkedin className="h-4 w-4" />
                        </a>
                      )}
                      {mentor.calendlyUrl && (
                        <a
                          href={mentor.calendlyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Preview Calendly"
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Calendar className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-middle">
                    {mentor.title || mentor.organization ? (
                      <div className="flex flex-col leading-tight">
                        {mentor.title && <span className="text-sm">{mentor.title}</span>}
                        {mentor.organization && (
                          <span className="text-xs text-muted-foreground">
                            {mentor.organization}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-middle max-w-[320px]">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {mentor.bio || '—'}
                    </p>
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="flex flex-wrap gap-1">
                      {mentor.tags && mentor.tags.length > 0 ? (
                        mentor.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right align-middle">
                    {kind === 'pending' ? (
                      <Button
                        size="sm"
                        onClick={() => setVisibility(mentor.id, true)}
                        disabled={busy}
                        className="gap-1"
                      >
                        {busy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Approve
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" disabled={busy} className="gap-1">
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                            Hide
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hide this mentor?</AlertDialogTitle>
                            <AlertDialogDescription>
                              &quot;{mentor.fullName}&quot; will be moved back to pending review and
                              will no longer appear in the public mentor directory.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => setVisibility(mentor.id, false)}>
                              Hide mentor
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
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
    <div className="space-y-6">
      <div
        className={`${isRefreshing ? 'opacity-60 pointer-events-none' : ''} transition-opacity duration-200`}
      >
        {getStatsCards()}
      </div>

      <Card
        className={`relative ${isRefreshing ? 'opacity-60' : ''} transition-opacity duration-200`}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Mentor Management</CardTitle>
                <CardDescription>
                  Review and approve mentor profiles submitted via LearnWorlds
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await fetchMentors();
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
          {mentors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p>No mentor profiles yet</p>
              <p className="text-sm">
                Mentors will appear here after they submit the onboarding form in LearnWorlds.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <Accordion type="multiple" defaultValue={['pending']}>
                  <AccordionItem value="pending" className="border-0">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-600" />
                        <span className="font-semibold">Pending Review</span>
                        <Badge variant="secondary" className="ml-2">
                          {pendingMentors.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {renderMentorTable(pendingMentors, 'pending')}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Accordion type="multiple">
                  <AccordionItem value="approved" className="border-0">
                    <AccordionTrigger className="hover:no-underline px-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <span className="font-semibold">Approved</span>
                        <Badge variant="secondary" className="ml-2">
                          {approvedMentors.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {renderMentorTable(approvedMentors, 'approved')}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isRefreshing && (
        <div className="fixed inset-0 bg-background/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-background/95 backdrop-blur-md border border-border/50 rounded-lg px-6 py-4 shadow-lg flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">Refreshing mentors...</span>
          </div>
        </div>
      )}
    </div>
  );
}
