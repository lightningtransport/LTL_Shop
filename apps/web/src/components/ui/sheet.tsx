'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import { Button } from './button';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

export const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    data-slot="sheet-overlay"
    className={cn(
      'fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  'fixed z-50 overflow-y-auto border bg-popover p-5 text-popover-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b data-[state=open]:slide-in-from-top-4 data-[state=closed]:slide-out-to-top-4',
        right: 'inset-y-0 right-0 h-full w-[min(24rem,calc(100%-1rem))] border-l data-[state=open]:slide-in-from-right-4 data-[state=closed]:slide-out-to-right-4',
        bottom: 'inset-x-0 bottom-0 max-h-[calc(100dvh-var(--app-safe-top))] rounded-t-xl border-t pb-[calc(1.25rem+var(--app-safe-bottom))] data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4',
        left: 'inset-y-0 left-0 h-full w-[min(24rem,calc(100%-1rem))] border-r data-[state=open]:slide-in-from-left-4 data-[state=closed]:slide-out-to-left-4',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  },
);

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>
  & VariantProps<typeof sheetVariants>
  & {
    showCloseButton?: boolean;
    closeLabel?: string;
  }
>(({ className, children, side, showCloseButton = true, closeLabel = 'Close panel', ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      data-slot="sheet-content"
      data-side={side}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <SheetClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-[max(0.5rem,var(--app-safe-top))]"
            aria-label={closeLabel}
          >
            <X aria-hidden="true" />
          </Button>
        </SheetClose>
      ) : null}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

export function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn('mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
}

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    data-slot="sheet-title"
    className={cn('font-display text-2xl font-bold tracking-wide', className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    data-slot="sheet-description"
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export { sheetVariants };
