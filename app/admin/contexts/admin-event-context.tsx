'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { toast } from 'sonner'

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

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/event')
      const data = await response.json()
      
      if (response.ok) {
        const newEvents = data.events || []
        setEvents(newEvents)
        
        // Auto-select logic - use current state instead of closure
        setSelectedEvent(currentSelected => {
          // Auto-select active event if no event is selected
          if (!currentSelected && newEvents.length > 0) {
            const activeEvent = newEvents.find((e: Event) => e.status === 'active')
            if (activeEvent) {
              return activeEvent
            } else {
              // If no active event, select the first event
              return newEvents[0]
            }
          } else if (currentSelected && newEvents.length > 0) {
            // Update selected event if it exists in the new events data (to sync status changes)
            const updatedSelectedEvent = newEvents.find((e: Event) => e.id === currentSelected.id)
            if (updatedSelectedEvent) {
              return updatedSelectedEvent
            }
          }
          return currentSelected
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
      toast.error('Error', {
        description: 'Failed to load events'
      })
    } finally {
      setIsLoading(false)
    }
  }, []) // Remove selectedEvent dependency to break the loop

  const refreshEvents = useCallback(async () => {
    await fetchEvents()
  }, [fetchEvents])

  const selectEvent = useCallback((event: Event | null) => {
    setSelectedEvent(event)
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

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