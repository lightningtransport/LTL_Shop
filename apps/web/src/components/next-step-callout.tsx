'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CalloutTone = 'warning' | 'primary' | 'success' | 'muted' | 'danger';

const TONE: Record<CalloutTone, { box: string; tile: string; eyebrow: string }> = {
  warning: { box: 'border-warning/40 bg-warning-surface/60', tile: 'bg-warning/15 text-warning-foreground dark:text-warning', eyebrow: 'text-warning-foreground dark:text-warning' },
  primary: { box: 'border-primary/40 bg-primary/[0.06]', tile: 'bg-primary/15 text-primary', eyebrow: 'text-primary' },
  success: { box: 'border-success/40 bg-success/[0.06]', tile: 'bg-success/15 text-success', eyebrow: 'text-success' },
  muted: { box: 'border-border bg-card', tile: 'bg-muted text-muted-foreground', eyebrow: 'text-muted-foreground' },
  danger: { box: 'border-destructive/40 bg-destructive/10', tile: 'bg-destructive/20 text-destructive-text', eyebrow: 'text-destructive-text' },
};

/**
 * Stage 8 (F7/F8/F9, mockups): the Next step as one callout — a tone, an icon tile, an eyebrow ("Next step ·
 * Blocker"), a title, a sub line, extra content and the action on the right; an optional footer (resolved
 * blockers). The Work Order, the Truck and the Dashboard use it; what it says comes from the API's Next step.
 */
export function NextStepCallout({
  tone,
  icon: Icon,
  eyebrow,
  title,
  sub,
  actions,
  extra,
  footer,
  testId,
  kind,
  id,
  className,
}: {
  tone: CalloutTone;
  icon: LucideIcon;
  eyebrow: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  testId?: string;
  kind?: string;
  id?: string;
  className?: string;
}) {
  const style = TONE[tone];
  return (
    <section id={id} className={cn('overflow-hidden rounded-xl border', style.box, className)} role="status" data-testid={testId} data-kind={kind} data-tone={tone}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className={cn('hidden size-9 shrink-0 place-items-center rounded-lg sm:grid', style.tile)}>
          <Icon aria-hidden="true" className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn('flex items-center gap-2 text-xs', style.eyebrow)}>
            <Icon aria-hidden="true" className="size-3.5 sm:hidden" />
            {eyebrow}
          </p>
          <p className="font-semibold">{title}</p>
          {sub ? <p className="text-muted-foreground">{sub}</p> : null}
          {extra}
        </div>
        {actions ? <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">{actions}</div> : null}
      </div>
      {footer}
    </section>
  );
}
