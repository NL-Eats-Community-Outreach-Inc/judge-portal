'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Building2 } from 'lucide-react';
import { useJudgeAssignmentContext } from './judge-assignment-provider';

export function EventPicker() {
  const { availableEvents, selectEvent } = useJudgeAssignmentContext();

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto min-h-full flex items-center justify-center">
      <div className="w-full space-y-6 md:space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <Calendar className="h-8 w-8 md:h-10 md:w-10 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Select an Event
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            You are assigned to multiple active events. Choose which event you&apos;d like to judge.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {availableEvents.map((event) => (
            <Card
              key={event.id}
              className="p-5 md:p-6 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 hover:bg-primary/5 border-2 border-transparent"
              onClick={() => selectEvent(event.id)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground text-base md:text-lg leading-tight">
                    {event.name}
                  </h3>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 shrink-0">
                    Active
                  </Badge>
                </div>
                {event.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {event.description}
                  </p>
                )}
                {event.organizationName && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{event.organizationName}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
