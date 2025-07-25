'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, Settings, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { useAdminEvent } from '../contexts/admin-event-context'

export default function EventSelector() {
  const { events, selectedEvent, isLoading, selectEvent } = useAdminEvent()

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-muted animate-pulse rounded" />
            <div className="w-32 h-4 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (events.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">No events found</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-3 w-3 text-green-600" />
      case 'completed':
        return <Clock className="h-3 w-3 text-gray-600" />
      default:
        return <Settings className="h-3 w-3 text-blue-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
      case 'completed':
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-800'
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
    }
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium text-foreground">Selected Event:</span>
            <Select
              value={selectedEvent?.id || ''}
              onValueChange={(value) => {
                const event = events.find(e => e.id === value)
                selectEvent(event || null)
              }}
            >
              <SelectTrigger className="min-w-64 max-w-md h-8 text-sm">
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    <div className="flex items-center gap-2 max-w-full">
                      {getStatusIcon(event.status)}
                      <span className="truncate">{event.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedEvent && (
            <Badge
              variant="outline"
              className={`mr-2 ${getStatusColor(selectedEvent.status)}`}
            >
              {selectedEvent.status}
            </Badge>
          )}
        </div>
        {/* {selectedEvent?.description && (
          <p className="text-xs text-muted-foreground mt-2 ml-7 truncate max-w-2xl">
            {selectedEvent.description}
          </p>
        )} */}
      </CardContent>
    </Card>
  )
}