'use client';

import { useRef, useState, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react';
import { cn } from '@/lib/utils';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  className,
}: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const digits = value.padEnd(length, ' ').split('').slice(0, length);

  const focusInput = (index: number) => {
    const input = inputRefs.current[index];
    if (input) {
      input.focus();
      input.select();
    }
  };

  const handleChange = (index: number, digit: string) => {
    if (disabled) return;

    // Only allow single digits
    const sanitized = digit.replace(/[^0-9]/g, '');
    if (sanitized.length === 0) {
      // Handle deletion
      const newValue = digits.map((d, i) => (i === index ? '' : d)).join('');
      onChange(newValue.trim());
      return;
    }

    // Take only the last digit if multiple chars
    const lastDigit = sanitized.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = lastDigit;
    const newValue = newDigits.join('').trim();

    onChange(newValue);

    // Auto-focus next input
    if (index < length - 1) {
      focusInput(index + 1);
    }

    // Check if complete
    if (newValue.length === length) {
      onComplete?.(newValue);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      if (!digits[index] || digits[index] === ' ') {
        // If current input is empty, go to previous
        if (index > 0) {
          e.preventDefault();
          const newDigits = [...digits];
          newDigits[index - 1] = '';
          onChange(newDigits.join('').trim());
          focusInput(index - 1);
        }
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled) return;

    const pastedData = e.clipboardData.getData('text');
    const sanitized = pastedData.replace(/[^0-9]/g, '').slice(0, length);

    onChange(sanitized);

    // Focus the next empty input or last input
    const nextIndex = Math.min(sanitized.length, length - 1);
    focusInput(nextIndex);

    // Check if complete
    if (sanitized.length === length) {
      onComplete?.(sanitized);
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  return (
    <div className={cn('flex gap-2', className)}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[index] === ' ' ? '' : digits[index]}
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => handleFocus(index)}
          onBlur={handleBlur}
          disabled={disabled}
          className={cn(
            'h-12 w-12 text-center text-lg font-semibold',
            'rounded-md border border-input bg-background',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            focusedIndex === index && 'ring-2 ring-ring ring-offset-2',
            digits[index] && digits[index] !== ' ' && 'border-primary'
          )}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
