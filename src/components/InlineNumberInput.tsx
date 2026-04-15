import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

interface InlineNumberInputProps {
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  min?: number;
  placeholder?: string;
}

/**
 * Inline table number input with local state.
 *
 * Keeps typed value in local state and only calls onChange on blur.
 * This prevents parent state updates (and row re-sorting) while the user
 * is still typing, which would shift DOM rows and lose focus.
 */
const InlineNumberInput = React.memo(function InlineNumberInput({
  value,
  onChange,
  disabled,
  className,
  min = 0,
  placeholder = '0',
}: InlineNumberInputProps) {
  const [localValue, setLocalValue] = useState(String(value ?? ''));
  const isFocused = useRef(false);

  // Sync external value changes only when this input is not focused
  // (e.g. initial load, external reset, saving completes)
  useEffect(() => {
    if (!isFocused.current) {
      // This local draft mirrors external table updates only while the user is not typing.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalValue(String(value ?? ''));
    }
  }, [value]);

  return (
    <Input
      className={className}
      type="number"
      min={min}
      placeholder={placeholder}
      value={localValue}
      disabled={disabled}
      onFocus={() => { isFocused.current = true; }}
      onBlur={(e) => {
        isFocused.current = false;
        onChange(e.target.value);
      }}
      onChange={(e) => setLocalValue(e.target.value)}
    />
  );
});

export { InlineNumberInput };
