'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Loader2, Plus, Target, Edit, Trash2, RefreshCw, GripVertical } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useAdminEvent } from '../contexts/admin-event-context'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Criterion {
  id: string
  name: string
  description: string | null
  minScore: number
  maxScore: number
  displayOrder: number
  createdAt: string
  updatedAt: string
  eventId: string
}

interface CriterionFormData {
  name: string
  description: string
  minScore: number
  maxScore: number
}

// Sortable Row Component
function SortableRow({ criterion, children }: { criterion: Criterion; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: criterion.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'z-50' : ''}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-move p-1 rounded hover:bg-muted"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <Badge variant="outline">#{criterion.displayOrder}</Badge>
        </div>
      </TableCell>
      {children}
    </TableRow>
  )
}

export default function CriteriaManagement() {
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCriterion, setEditingCriterion] = useState<Criterion | null>(null)
  const [formData, setFormData] = useState<CriterionFormData>({
    name: '',
    description: '',
    minScore: 1,
    maxScore: 10
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingCriteria, setDeletingCriteria] = useState(new Set<string>())
  const [criterionToDelete, setCriterionToDelete] = useState<Criterion | null>(null)
  const { toast } = useToast()
  const { selectedEvent } = useAdminEvent()

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!active || !over || active.id === over.id) {
      return
    }

    const oldIndex = criteria.findIndex((criterion) => criterion.id === active.id)
    const newIndex = criteria.findIndex((criterion) => criterion.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Optimistic update
    const newCriteria = arrayMove(criteria, oldIndex, newIndex)
    // Update display orders
    const updatedCriteria = newCriteria.map((criterion, index) => ({
      ...criterion,
      displayOrder: index + 1
    }))
    
    setCriteria(updatedCriteria)

    // Send to backend
    try {
      const response = await fetch('/api/admin/criteria/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventId: selectedEvent?.id,
          criteriaOrders: updatedCriteria.map(criterion => ({
            id: criterion.id,
            displayOrder: criterion.displayOrder
          }))
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update criteria order')
      }

      toast({
        title: 'Success',
        description: 'Criteria order updated successfully'
      })
    } catch (error) {
      console.error('Error updating criteria order:', error)
      // Revert on error
      setCriteria(criteria)
      toast({
        title: 'Error',
        description: 'Failed to update criteria order',
        variant: 'destructive'
      })
    }
  }

  const fetchCriteria = useCallback(async () => {
    if (!selectedEvent) {
      setCriteria([])
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/admin/criteria?eventId=${selectedEvent.id}`)
      const data = await response.json()
      
      if (response.ok) {
        setCriteria(data.criteria)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error fetching criteria:', error)
      toast({
        title: 'Error',
        description: 'Failed to load criteria',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedEvent, toast])

  useEffect(() => {
    if (selectedEvent) {
      fetchCriteria()
    }
  }, [selectedEvent, fetchCriteria])

  const openDialog = (criterion?: Criterion) => {
    if (criterion) {
      setEditingCriterion(criterion)
      setFormData({
        name: criterion.name,
        description: criterion.description || '',
        minScore: criterion.minScore,
        maxScore: criterion.maxScore
      })
    } else {
      setEditingCriterion(null)
      setFormData({
        name: '',
        description: '',
        minScore: 1,
        maxScore: 10
      })
    }
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingCriterion(null)
    setFormData({
      name: '',
      description: '',
      minScore: 1,
      maxScore: 10
    })
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Criterion name is required',
        variant: 'destructive'
      })
      return
    }

    if (formData.minScore >= formData.maxScore) {
      toast({
        title: 'Validation Error',
        description: 'Min score must be less than max score',
        variant: 'destructive'
      })
      return
    }

    if (!selectedEvent) {
      toast({
        title: 'Error',
        description: 'No event selected',
        variant: 'destructive'
      })
      return
    }

    setIsSubmitting(true)
    try {
      const url = editingCriterion ? `/api/admin/criteria/${editingCriterion.id}` : '/api/admin/criteria'
      const method = editingCriterion ? 'PUT' : 'POST'
      
      const requestBody = editingCriterion 
        ? { ...formData, displayOrder: editingCriterion.displayOrder }
        : { ...formData, eventId: selectedEvent.id, displayOrder: criteria.length + 1 }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save criterion')
      }

      const data = await response.json()
      
      if (editingCriterion) {
        setCriteria(prev => prev.map(criterion => 
          criterion.id === editingCriterion.id ? data.criterion : criterion
        ))
        toast({
          title: 'Success',
          description: 'Criterion updated successfully'
        })
      } else {
        setCriteria(prev => [...prev, data.criterion].sort((a, b) => a.displayOrder - b.displayOrder))
        toast({
          title: 'Success',
          description: 'Criterion created successfully'
        })
      }
      
      closeDialog()
    } catch (error) {
      console.error('Error saving criterion:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save criterion',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!criterionToDelete) return

    setDeletingCriteria(prev => new Set(prev).add(criterionToDelete.id))
    
    try {
      const response = await fetch(`/api/admin/criteria/${criterionToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete criterion')
      }

      setCriteria(prev => prev.filter(criterion => criterion.id !== criterionToDelete.id))
      toast({
        title: 'Success',
        description: 'Criterion deleted successfully'
      })
      setCriterionToDelete(null)
    } catch (error) {
      console.error('Error deleting criterion:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete criterion',
        variant: 'destructive'
      })
    } finally {
      setDeletingCriteria(prev => {
        const next = new Set(prev)
        next.delete(criterionToDelete.id)
        return next
      })
    }
  }

  const getStatsCard = () => (
    <Card className="mb-6">
      <CardContent className="flex items-center p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg mr-4 shadow-sm">
          <Target className="h-6 w-6 text-gray-700 dark:text-gray-300" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{criteria.length}</p>
          <p className="text-muted-foreground text-sm">Scoring Criteria</p>
        </div>
      </CardContent>
    </Card>
  )

  if (!selectedEvent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-center">No event selected</p>
          <p className="text-sm text-muted-foreground text-center">Select an event above to manage criteria</p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {getStatsCard()}
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Scoring Criteria</CardTitle>
                <CardDescription>
                  Define and manage judging criteria and score ranges for {selectedEvent.name}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={fetchCriteria}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => openDialog()} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Criterion
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingCriterion ? 'Edit Criterion' : 'Create New Criterion'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingCriterion ? 'Update criterion information' : 'Add a new scoring criterion'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="criterion-name">Criterion Name *</Label>
                      <Input
                        id="criterion-name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Innovation, Technical Implementation"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="criterion-description">Description</Label>
                      <Textarea
                        id="criterion-description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe what this criterion evaluates"
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="min-score">Min Score</Label>
                        <Input
                          id="min-score"
                          type="number"
                          min="0"
                          value={formData.minScore}
                          onChange={(e) => setFormData(prev => ({ ...prev, minScore: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="max-score">Max Score</Label>
                        <Input
                          id="max-score"
                          type="number"
                          min="1"
                          value={formData.maxScore}
                          onChange={(e) => setFormData(prev => ({ ...prev, maxScore: parseInt(e.target.value) || 1 }))}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeDialog}>
                      Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {editingCriterion ? 'Update Criterion' : 'Create Criterion'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {criteria.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p>No scoring criteria yet</p>
              <p className="text-sm">Create your first criterion to get started</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <DndContext 
                sensors={sensors} 
                collisionDetection={closestCenter} 
                onDragEnd={handleDragEnd}
              >
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Order</TableHead>
                      <TableHead className="w-48">Criterion Name</TableHead>
                      <TableHead className="w-64">Description</TableHead>
                      <TableHead className="w-32">Score Range</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext 
                      items={criteria.map(criterion => criterion.id)} 
                      strategy={verticalListSortingStrategy}
                    >
                      {criteria.map((criterion) => (
                        <SortableRow key={criterion.id} criterion={criterion}>
                          <TableCell className="font-medium w-48">
                            <div className="truncate" title={criterion.name}>
                              {criterion.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground w-64">
                            <div className="truncate" title={criterion.description || ''}>
                              {criterion.description || '—'}
                            </div>
                          </TableCell>
                          <TableCell className="w-32">
                            <Badge variant="secondary">
                              {criterion.minScore} - {criterion.maxScore}
                            </Badge>
                          </TableCell>
                          <TableCell className="w-32">
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDialog(criterion)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCriterionToDelete(criterion)}
                                    disabled={deletingCriteria.has(criterion.id)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                  >
                                    {deletingCriteria.has(criterion.id) ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the criterion &quot;{criterion.name}&quot; and all associated scores.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setCriterionToDelete(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Delete Criterion
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </SortableRow>
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}