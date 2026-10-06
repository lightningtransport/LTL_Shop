'use client';

import { AlertTriangle, Check, CircleDashed, CircleDot, Flag, Minus, Truck } from 'lucide-react';
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
  }
}

const TONE: Record<TruckStepState, string> = {
  done: 'border-shop-success/40 text-shop-success',
  pending: 'border-border text-foreground',
  blocked: 'border-warning bg-warning-surface text-warning-foreground',
  external: 'border-warning bg-warning-surface text-warning-foreground',
  missing: 'border-destructive text-destructive-text',
  not_applicable: 'border-dashed border-border text-muted-foreground',
  ready: 'border-primary bg-accent text-primary',
};

export function TruckStepIcon({ state }: { state: TruckStepState }) {
  const props = { 'aria-hidden': true, className: 'size-3.5 shrink-0' } as const;
  if (state === 'done') return <Check {...props} />;
  if (state === 'blocked' || state === 'missing') return <AlertTriangle {...props} />;
  if (state === 'external') return <Truck {...props} />;
  if (state === 'not_applicable') return <Minus {...props} />;
  if (state === 'ready') return <Flag {...props} />;
  return state === 'pending' ? <CircleDot {...props} /> : <CircleDashed {...props} />;
}

/**
 * Stage 4 (UX-4-001): the steps to leave the shop as a row of pills under the header. Each pill goes
 * to its step on the Work Plan (and opens it).
 */
export function TruckStepper({ steps, messages, onSelect }: { steps: TruckStep[]; messages: AdminMessages; onSelect: (key: TruckStepKey) => void }) {
  if (steps.length < 2) return null;
  return (
    // Phones: one row that scrolls sideways (the page itself never scrolls sideways).
    <nav aria-label={messages.truckStepsLabel} data-testid="truck-stepper" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
      <ol className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
        {steps.map((step) => (
          <li key={step.key}>
            <button
              type="button"
              data-state={step.state}
              onClick={() => onSelect(step.key)}
              className={`relative inline-flex min-h-9 items-center whitespace-nowrap gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${TONE[step.state]}`}
            >
              <TruckStepIcon state={step.state} />
              <span>{truckStepLabel(step.key, messages)}</span>
              <span className="sr-only">: {truckStepStateLabel(step, messages)}</span>
              {step.state === 'pending' && step.remaining ? <span aria-hidden="true" className="tabular-nums text-muted-foreground">{step.remaining}</span> : null}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
