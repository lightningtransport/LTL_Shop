import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export function Empty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty"
      className={cn('flex min-w-0 flex-col items-center justify-center gap-4 text-center', className)}
      {...props}
    />
  );
}

export function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="empty-header" className={cn('flex max-w-sm flex-col items-center gap-2', className)} {...props} />;
}

const emptyMediaVariants = cva(
  'flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: 'size-10 rounded-lg bg-muted text-muted-foreground [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export function EmptyMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>) {
  return <div data-slot="empty-media" className={cn(emptyMediaVariants({ variant }), className)} {...props} />;
}

export function EmptyTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="empty-title" className={cn('font-medium text-foreground', className)} {...props} />;
}

export function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="empty-description"
      className={cn('text-pretty text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}

export function EmptyContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="empty-content" className={cn('flex w-full max-w-sm flex-col items-center gap-2', className)} {...props} />;
}

export { emptyMediaVariants };
