'use client';

import { Fragment } from 'react';
import { Building2, Check, ChevronRight, Circle, CircleAlert, CircleDot, Flag, Minus, OctagonPause } from 'lucide-react';
import type { AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { TruckStep, TruckStepKey, TruckStepState } from '@/lib/truck-stepper';

export function truckStepLabel(key: TruckStepKey, messages: AdminMessages) {
  switch (key) {
    case 'inspection': return messages.inspection;
    case 'shop_work': return messages.shopWork;
    case 'pm': return messages.pm;
    case 'alignment': return messages.alignment;
    case 'detailing': return messages.detailing;
    case 'quality_check': return messages.qualityCheck;
    case 'close': return messages.readinessCloseWorkOrder;
  }
}

export function truckStepStateLabel(step: TruckStep, messages: AdminMessages) {
  switch (step.state) {
    case 'done': return messages.truckStepDone;
    case 'pending': return step.remaining ? fillPlaceholders(messages.truckStepPending, { count: String(step.remaining) }) : messages.workPlanMandatoryPending;
    case 'blocked': return messages.blocked;
    case 'external': return messages.externalStatus;
    case 'missing': return messages.truckStepMissing;
    case 'not_applicable': return messages.workPlanMandatoryNotApplicable;
    case 'ready': return messages.readinessReadyToClose;
    case 'waiting': return messages.stepWaitingTip;
  }
}

/** Stage 8 (mockup): each state's pill and icon tile colors. */
export const STEP_TONE: Record<TruckStepState, { pill: string; tile: string }> = {
  done: { pill: 'border-success/30 bg-success/15 text-success', tile: 'bg-success/15 text-success' },
  pending: { pill: 'border-warning/40 bg-warning/10 text-warning-foreground dark:text-warning', tile: 'bg-warning/10 text-warning-foreground dark:text-warning' },
  blocked: { pill: 'border-warning/50 bg-warning/15 text-warning-foreground dark:text-warning', tile: 'bg-warning/15 text-warning-foreground dark:text-warning' },
  external: { pill: 'border-primary/40 bg-primary/10 text-primary', tile: 'bg-primary/15 text-primary' },
  missing: { pill: 'border-destructive/40 bg-destructive/15 text-destructive-text', tile: 'bg-destructive/20 text-destructive-text' },
  not_applicable: { pill: 'border-border bg-muted text-muted-foreground', tile: 'bg-muted text-muted-foreground' },
  ready: { pill: 'border-primary/40 bg-primary/10 text-primary', tile: 'bg-primary/15 text-primary' },
  waiting: { pill: 'border-border bg-card text-muted-foreground', tile: 'border border-dashed border-muted-foreground/50 text-muted-foreground' },
};

export function TruckStepIcon({ state, className = 'size-3.5 shrink-0' }: { state: TruckStepState; className?: string }) {
  const props = { 'aria-hidden': true, className } as const;
  if (state === 'done') return <Check {...props} />;
  if (state === 'blocked') return <OctagonPause {...props} />;
  if (state === 'missing') return <CircleAlert {...props} />;
  if (state === 'external') return <Building2 {...props} />;
  if (state === 'not_applicable') return <Minus {...props} />;
  if (state === 'ready') return <Flag {...props} />;
  if (state === 'waiting') return <Circle {...props} />;
  return <CircleDot {...props} />;
}

/**
 * Stage 4 (UX-4-001) / Stage 8 (mockup): the steps to leave the shop as a row of colored pills with chevrons
 * between them. Each pill goes to its step on the Work Plan (and opens it). Phones: one row that scrolls
 * sideways with a fade at the edge (the page itself never scrolls sideways).
 */
export function TruckStepper({ steps, messages, onSelect }: { steps: TruckStep[]; messages: AdminMessages; onSelect: (key: TruckStepKey) => void }) {
  if (steps.length < 2) return null;
  return (
    <nav aria-label={messages.truckStepsLabel} data-testid="truck-stepper" className="min-w-0">
      <ol className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 sm:[mask-image:none]">
        {steps.map((step, index) => (
          <Fragment key={step.key}>
            {index ? <li aria-hidden="true" className="hidden text-border sm:block"><ChevronRight className="size-3.5" /></li> : null}
            <li>
              <button
                type="button"
                data-state={step.state}
                title={`${truckStepLabel(step.key, messages)}: ${truckStepStateLabel(step, messages)}`}
                onClick={() => onSelect(step.key)}
                className={`relative inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${STEP_TONE[step.state].pill}`}
              >
                <TruckStepIcon state={step.state} />
                <span>{truckStepLabel(step.key, messages)}</span>
                {step.remaining && step.state !== 'done' ? <span aria-hidden="true" className="tnum">{step.remaining}</span> : null}
                <span className="sr-only">: {truckStepStateLabel(step, messages)}</span>
              </button>
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
