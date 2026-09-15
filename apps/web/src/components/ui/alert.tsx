import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'group/alert relative w-full rounded-xl border px-4 py-3 text-sm has-[>svg]:grid has-[>svg]:grid-cols-[auto_minmax(0,1fr)] has-[>svg]:items-start has-[>svg]:gap-x-3 [&>svg]:mt-0.5 [&>svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
        warning: 'border-warning/40 bg-warning-surface text-warning-foreground',
        success: 'border-shop-success/40 bg-shop-success/10 text-shop-success',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-title" className={cn('font-medium leading-none', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn('text-sm leading-relaxed group-has-[>svg]/alert:col-start-2 [&_p]:leading-relaxed', className)}
      {...props}
    />
  );
}

export function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-action" className={cn('mt-2 group-has-[>svg]/alert:col-start-2', className)} {...props} />;
}

export { alertVariants };
