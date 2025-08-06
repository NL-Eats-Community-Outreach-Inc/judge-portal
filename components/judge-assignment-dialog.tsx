'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Users, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Judge {
  id: string
  email: string
}

interface AssignedJudge {
  judgeId: string
  email: string
  assignedAt: string
}

interface JudgeAssignmentDialogProps {
  eventId: string | null
  eventName: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onAssignmentsUpdated: () => void
}

export default function JudgeAssignmentDialog({
  eventId,
  eventName,
  isOpen,
  onOpenChange,
  onAssignmentsUpdated
}: JudgeAssignmentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [judges, setJudges] = useState<Judge[]>([])
  const [assignedJudges, setAssignedJudges] = useState<AssignedJudge[]>([])
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>([])

  const fetchJudgeAssignments = useCallback(async () => {
    if (!eventId) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/event-judges?eventId=${eventId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch judge assignments')
      }
      
      const data = await response.json()
      setJudges(data.available)
      setAssignedJudges(data.assigned)
      setSelectedJudgeIds(data.assigned.map((j: AssignedJudge) => j.judgeId))
    } catch (error) {
      console.error('Error fetching judge assignments:', error)
      toast.error('Error', {
        description: 'Failed to load judge assignments'
      })
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (isOpen && eventId) {
      fetchJudgeAssignments()
    }
  }, [isOpen, eventId, fetchJudgeAssignments])

  const handleSave = async () => {
    if (!eventId) return
    
    setSaving(true)
    try {
      const response = await fetch('/api/admin/event-judges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventId,
          judgeIds: selectedJudgeIds
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update judge assignments')
      }

      toast.success('Success', {
        description: 'Judge assignments updated successfully'
      })
      
      onAssignmentsUpdated()
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating judge assignments:', error)
      toast.error('Error', {
        description: 'Failed to update judge assignments'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleJudgeToggle = (judgeId: string, checked: boolean) => {
    setSelectedJudgeIds(prev => 
      checked 
        ? [...prev, judgeId]
        : prev.filter(id => id !== judgeId)
    )
  }

  const assignedCount = selectedJudgeIds.length
  const totalJudges = judges.length

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Judge Assignments
          </DialogTitle>
          <DialogDescription>
            Assign judges to &quot;{eventName}&quot;. Only assigned judges can score this event.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8" tabIndex={0} autoFocus>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Assignment Summary */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">
                {assignedCount} of {totalJudges} judges assigned
              </span>
            </div>

            {/* Judge List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {judges.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No judges found in the system
                </p>
              ) : (
                judges.map((judge) => {
                  const isSelected = selectedJudgeIds.includes(judge.id)
                  const wasAssigned = assignedJudges.some(aj => aj.judgeId === judge.id)
                  
                  return (
                    <div key={judge.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <Checkbox
                        id={judge.id}
                        checked={isSelected}
                        onCheckedChange={(checked) => handleJudgeToggle(judge.id, checked as boolean)}
                      />
                      <div className="flex-1 min-w-0">
                        <label 
                          htmlFor={judge.id}
                          className="text-sm font-medium cursor-pointer truncate block"
                        >
                          {judge.email}
                        </label>
                        {wasAssigned && (
                          <p className="text-xs text-muted-foreground">
                            Previously assigned
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1"
                autoFocus
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Assignments'
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}