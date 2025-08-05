'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useToast } from '@/components/ui/use-toast'

interface Event {
  id: string
  name: string
  description: string | null
  status: 'setup' | 'active' | 'completed'
  createdAt: string
  updatedAt: string
}

interface AdminEventContextType {
  events: Event[]
  selectedEvent: Event | null
  isLoading: boolean
  selectEvent: (event: Event | null) => void
  refreshEvents: () => Promise<void>
}

const AdminEventContext = createContext<AdminEventContextType | undefined>(undefined)

export function AdminEventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/admin/event')
      const data = await response.json()
      
      if (response.ok) {
        setEvents(data.events || [])
        
        // Smart event selection logic
        if (data.events?.length > 0) {
          const activeEvent = data.events.find((e: Event) => e.status === 'active')
          const currentEventStillExists = selectedEvent ? data.events.find((e: Event) => e.id === selectedEvent.id) : null
          
          if (activeEvent) {
            // Always prefer active event
            setSelectedEvent(activeEvent)
          } else if (currentEventStillExists) {
            // Keep current selection if it still exists and no active event
            setSelectedEvent(currentEventStillExists)
          } else {
            // Fallback to first event if no active event and current selection is invalid/missing
            setSelectedEvent(data.events[0])
          }
        }
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
      toast({
        title: 'Error',
        description: 'Failed to load events',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const refreshEvents = async () => {
    await fetchEvents()
  }

  const selectEvent = (event: Event | null) => {
    setSelectedEvent(event)
  }

  useEffect(() => {
    fetchEvents()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const value: AdminEventContextType = {
    events,
    selectedEvent,
    isLoading,
    selectEvent,
    refreshEvents
  }

  return (
    <AdminEventContext.Provider value={value}>
      {children}
    </AdminEventContext.Provider>
  )
}

export function useAdminEvent() {
  const context = useContext(AdminEventContext)
  if (context === undefined) {
    throw new Error('useAdminEvent must be used within an AdminEventProvider')
  }
  return context
}