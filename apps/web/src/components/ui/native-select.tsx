'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NativeSelectProps = Omit<React.ComponentProps<'select'>, 'size'> & {
  size?: 'sm' | 'default';
};

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, children, size = 'default', ...props }, ref) => (
    <div data-slot="native-select-wrapper" className="relative w-full min-w-0">
      <select
        ref={ref}
        data-slot="native-select"
        data-size={size}
        className={cn(
          'w-full appearance-none rounded-lg border border-input bg-background text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          size === 'default' ? 'min-h-11 px-4 py-2.5 pr-11 text-base md:text-sm' : 'min-h-9 px-3 py-2 pr-9 text-sm',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        data-slot="native-select-icon"
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground',
          size === 'default' ? 'right-4 size-4' : 'right-3 size-3.5',
        )}
      />
    </div>
  ),
);
NativeSelect.displayName = 'NativeSelect';

export function NativeSelectOption(props: React.ComponentProps<'option'>) {
  return <option data-slot="native-select-option" {...props} />;
}

export function NativeSelectOptGroup(props: React.ComponentProps<'optgroup'>) {
  return <optgroup data-slot="native-select-optgroup" {...props} />;
}
