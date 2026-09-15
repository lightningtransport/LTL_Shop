'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Label } from './label';
import { Separator } from './separator';

export function FieldSet({ className, ...props }: React.ComponentProps<'fieldset'>) {
  return <fieldset data-slot="field-set" className={cn('flex flex-col gap-5', className)} {...props} />;
}

export function FieldLegend({
  className,
  variant = 'legend',
  ...props
}: React.ComponentProps<'legend'> & { variant?: 'legend' | 'label' }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        variant === 'legend'
          ? 'font-display text-lg font-semibold tracking-wide'
          : 'text-sm font-medium',
        className,
      )}
      {...props}
    />
  );
}

export function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-group"
      className={cn('@container/field-group flex w-full flex-col gap-4', className)}
      {...props}
    />
  );
}

const fieldVariants = cva('group/field flex w-full gap-2 data-[invalid=true]:text-destructive', {
  variants: {
    orientation: {
      vertical: 'flex-col *:w-full [&>.sr-only]:w-auto',
      horizontal: 'flex-row items-center [&>[data-slot=field-label]]:flex-auto',
      responsive: 'flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto',
    },
  },
  defaultVariants: {
    orientation: 'vertical',
  },
});

export function Field({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

export function FieldContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="field-content" className={cn('flex flex-1 flex-col gap-1', className)} {...props} />;
}

export function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label data-slot="field-label" className={cn('w-fit', className)} {...props} />;
}

export function FieldTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="field-title" className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}

export function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      className={cn('text-sm leading-normal text-muted-foreground', className)}
      {...props}
    />
  );
}

export function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<'div'> & { children?: React.ReactNode }) {
  return (
    <div data-slot="field-separator" className={cn('relative -my-1 h-5 text-sm', className)} {...props}>
      <Separator className="absolute inset-x-0 top-1/2" />
      {children ? (
        <span className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground">{children}</span>
      ) : null}
    </div>
  );
}

export function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<'div'> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = React.useMemo(() => {
    if (children) return children;
    const uniqueErrors = [...new Map(errors?.map((error) => [error?.message, error]) ?? []).values()]
      .filter((error) => error?.message);
    if (uniqueErrors.length === 0) return null;
    if (uniqueErrors.length === 1) return uniqueErrors[0]?.message;
    return (
      <ul className="ml-4 list-disc">
        {uniqueErrors.map((error) => <li key={error?.message}>{error?.message}</li>)}
      </ul>
    );
  }, [children, errors]);

  if (!content) return null;
  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn('text-sm text-destructive', className)}
      {...props}
    >
      {content}
    </div>
  );
}
