'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface DateTimePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select date and time',
  className,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    setSelectedDate(value);
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Preserve the time from the currently selected date if it exists
      const newDate = new Date(date);
      if (selectedDate) {
        newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      } else {
        // Set default time to 12:00 PM
        newDate.setHours(12, 0, 0, 0);
      }
      setSelectedDate(newDate);
      onChange?.(newDate);
    } else {
      setSelectedDate(undefined);
      onChange?.(undefined);
    }
  };

  const handleTimeChange = React.useCallback(
    (type: 'hour' | 'minute' | 'ampm', value: string | number) => {
      const currentDate = selectedDate || new Date();
      const newDate = new Date(currentDate);

      if (type === 'hour') {
        const hour = typeof value === 'number' ? value : parseInt(value, 10);
        const currentHours = newDate.getHours();
        const isPM = currentHours >= 12;

        if (isPM) {
          // PM hours
          newDate.setHours(hour === 12 ? 12 : hour + 12);
        } else {
          // AM hours
          newDate.setHours(hour === 12 ? 0 : hour);
        }
      } else if (type === 'minute') {
        const minute = typeof value === 'number' ? value : parseInt(value, 10);
        newDate.setMinutes(minute);
      } else if (type === 'ampm') {
        const hours = newDate.getHours();
        if (value === 'AM' && hours >= 12) {
          newDate.setHours(hours - 12);
        } else if (value === 'PM' && hours < 12) {
          newDate.setHours(hours + 12);
        }
      }

      newDate.setSeconds(0, 0);
      setSelectedDate(newDate);
      onChange?.(newDate);
    },
    [selectedDate, onChange]
  );

  const getHour12 = () => {
    if (!selectedDate) return 12;
    const hours = selectedDate.getHours();
    if (hours === 0) return 12;
    if (hours > 12) return hours - 12;
    return hours;
  };

  const getMinute = () => {
    if (!selectedDate) return 0;
    return selectedDate.getMinutes();
  };

  const getAmPm = () => {
    if (!selectedDate) return 'AM';
    return selectedDate.getHours() >= 12 ? 'PM' : 'AM';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={'outline'}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selectedDate && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
          type="button"
        >
          {selectedDate ? format(selectedDate, 'MM/dd/yyyy hh:mm aa') : <span>{placeholder}</span>}
          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="sm:flex">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          />
          <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x">
            {/* Hours */}
            <ScrollArea className="w-64 sm:w-auto sm:h-[300px]">
              <div className="flex flex-row sm:flex-col p-2 gap-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                  <Button
                    key={hour}
                    size="icon"
                    variant={getHour12() === hour ? 'default' : 'ghost'}
                    className="sm:w-full shrink-0 aspect-square h-9 w-9"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleTimeChange('hour', hour);
                    }}
                    type="button"
                  >
                    {hour}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>

            {/* Minutes */}
            <ScrollArea className="w-64 sm:w-auto sm:h-[300px]">
              <div className="flex flex-row sm:flex-col p-2 gap-1">
                {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                  <Button
                    key={minute}
                    size="icon"
                    variant={getMinute() === minute ? 'default' : 'ghost'}
                    className="sm:w-full shrink-0 aspect-square h-9 w-9"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleTimeChange('minute', minute);
                    }}
                    type="button"
                  >
                    {minute.toString().padStart(2, '0')}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>

            {/* AM/PM */}
            <ScrollArea className="sm:h-[300px]">
              <div className="flex flex-row sm:flex-col p-2 gap-1">
                {['AM', 'PM'].map((ampm) => (
                  <Button
                    key={ampm}
                    size="icon"
                    variant={getAmPm() === ampm ? 'default' : 'ghost'}
                    className="sm:w-full shrink-0 aspect-square h-9 w-9"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleTimeChange('ampm', ampm);
                    }}
                    type="button"
                  >
                    {ampm}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
