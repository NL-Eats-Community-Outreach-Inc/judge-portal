'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateTimePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Select date',
  className,
  disabled = false,
}: DateTimePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(() => {
    if (value) {
      return new Date(value);
    }
    return undefined;
  });

  const [time, setTime] = React.useState<string>(() => {
    if (value) {
      const d = new Date(value);
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return '00:00';
  });

  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setDate(d);
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        setTime(`${hours}:${minutes}`);
      }
    } else {
      setDate(undefined);
      setTime('00:00');
    }
  }, [value]);

  const updateDateTime = (newDate: Date | undefined, newTime: string) => {
    if (!newDate) {
      onChange?.('');
      return;
    }

    const [hours, minutes] = newTime.split(':').map(Number);
    const updatedDate = new Date(newDate);
    updatedDate.setHours(hours || 0, minutes || 0, 0, 0);

    // Format as YYYY-MM-DDTHH:mm for datetime-local compatibility
    const year = updatedDate.getFullYear();
    const month = (updatedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = updatedDate.getDate().toString().padStart(2, '0');
    const hoursStr = (hours || 0).toString().padStart(2, '0');
    const minutesStr = (minutes || 0).toString().padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}T${hoursStr}:${minutesStr}`;

    onChange?.(formattedDate);
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    updateDateTime(selectedDate, time);
    setIsOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    if (date) {
      updateDateTime(date, newTime);
    }
  };

  const handleClear = () => {
    setDate(undefined);
    setTime('00:00');
    onChange?.('');
  };

  return (
    <div className={cn('flex gap-2 items-center', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'flex-1 justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'PPP') : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 z-[9999]"
          align="start"
          sideOffset={4}
          style={{ zIndex: 9999 }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Calendar mode="single" selected={date} onSelect={handleDateSelect} />
          </div>
        </PopoverContent>
      </Popover>

      <Input
        type="time"
        value={time}
        onChange={handleTimeChange}
        disabled={disabled}
        className="w-[110px] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        placeholder="00:00"
      />

      {date && !disabled && (
        <Button variant="ghost" size="icon" onClick={handleClear} className="h-9 w-9" type="button">
          <X className="h-4 w-4" />
          <span className="sr-only">Clear date</span>
        </Button>
      )}
    </div>
  );
}
