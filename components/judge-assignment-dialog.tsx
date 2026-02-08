'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Users, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Judge {
  id: string;
  email: string;
}

interface AssignedJudge {
  judgeId: string;
  email: string;
  assignedAt: string;
}

interface JudgeAssignmentDialogProps {
  eventId: string | null;
  eventName: string;
  eventStatus: 'setup' | 'open' | 'active' | 'completed';
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignmentsUpdated: () => void;
}

const truncateEventName = (name: string, maxLength: number = 50) => {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength) + '...';
};

export default function JudgeAssignmentDialog({
  eventId,
  eventName,
  eventStatus,
  isOpen,
  onOpenChange,
  onAssignmentsUpdated,
}: JudgeAssignmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [assignedJudges, setAssignedJudges] = useState<AssignedJudge[]>([]);
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>([]);

  const fetchJudgeAssignments = useCallback(async () => {
    if (!eventId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/event-judges?eventId=${eventId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch judge assignments');
      }

      const data = await response.json();
      setJudges(data.available);
      setAssignedJudges(data.assigned);

      // Filter selectedJudgeIds to only include IDs present in available judges
      // This prevents 403 errors when saving (non-org judges are preserved server-side)
      const availableIds = new Set(data.available.map((j: Judge) => j.id));
      setSelectedJudgeIds(
        data.assigned
          .filter((aj: AssignedJudge) => availableIds.has(aj.judgeId))
          .map((aj: AssignedJudge) => aj.judgeId)
      );
    } catch (error) {
      console.error('Error fetching judge assignments:', error);
      toast.error('Error', {
        description: 'Failed to load judge assignments',
      });
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (isOpen && eventId) {
      fetchJudgeAssignments();
    }
  }, [isOpen, eventId, fetchJudgeAssignments]);

  const handleSave = async () => {
    if (!eventId) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/event-judges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          judgeIds: selectedJudgeIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update judge assignments');
      }

      toast.success('Success', {
        description: 'Judge assignments updated successfully',
      });

      onAssignmentsUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating judge assignments:', error);
      toast.error('Error', {
        description: 'Failed to update judge assignments',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleJudgeToggle = (judgeId: string, checked: boolean) => {
    setSelectedJudgeIds((prev) =>
      checked ? [...prev, judgeId] : prev.filter((id) => id !== judgeId)
    );
  };

  // Compute dropped judges: assigned but NOT in available (org members)
  const droppedJudges = useMemo(() => {
    const availableIds = new Set(judges.map((j) => j.id));
    return assignedJudges.filter((aj) => !availableIds.has(aj.judgeId));
  }, [judges, assignedJudges]);

  const assignedOrgCount = selectedJudgeIds.length;
  const totalOrgJudges = judges.length;
  const isActiveOrCompleted = eventStatus === 'active' || eventStatus === 'completed';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Judge Assignments
          </DialogTitle>
          <DialogDescription>
            Assign judges to &quot;{truncateEventName(eventName)}&quot;. Only assigned judges can
            score this event.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8" tabIndex={0} autoFocus>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Warning for active/completed events */}
            {isActiveOrCompleted && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Removing judges from an {eventStatus} event will exclude their scores from
                  results.
                </p>
              </div>
            )}

            {/* Dropped judges info (non-org judges with preserved scores) */}
            {droppedJudges.length > 0 && isActiveOrCompleted && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    The following judges are no longer in your organization but their scores are
                    preserved in this event&apos;s results:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {droppedJudges.map((judge) => (
                      <li key={judge.judgeId} className="text-xs text-blue-600 dark:text-blue-400">
                        {judge.email}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Assignment Summary */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">
                {assignedOrgCount} of {totalOrgJudges} org judges assigned
                {droppedJudges.length > 0 && (
                  <span className="text-muted-foreground font-normal">
                    {' '}
                    + {droppedJudges.length} external with preserved scores
                  </span>
                )}
              </span>
            </div>

            {/* Judge List */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {judges.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No judges found in your organization
                </p>
              ) : (
                judges.map((judge) => {
                  const isSelected = selectedJudgeIds.includes(judge.id);
                  const wasAssigned = assignedJudges.some((aj) => aj.judgeId === judge.id);

                  return (
                    <div
                      key={judge.id}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={judge.id}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleJudgeToggle(judge.id, checked as boolean)
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={judge.id}
                          className="text-sm font-medium cursor-pointer truncate block"
                        >
                          {judge.email}
                        </label>
                        {wasAssigned && (
                          <p className="text-xs text-muted-foreground">Previously assigned</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} disabled={saving} className="flex-1" autoFocus>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Assignments'
                )}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
