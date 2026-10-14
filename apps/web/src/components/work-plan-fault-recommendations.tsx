'use client';

import { useState } from 'react';
import { Link2, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { TruckFaultRecommendationDto } from '@ltl-shop/shared';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { cn } from '@/lib/utils';
import { Badge, Button, InlineAlert, Input } from './ui';

/**
 * D42 / S-6 (OPEN_ISSUES §1x): the top of Add work. Each recommended fault shows why (STOP light, warning light, check
 * engine), its learned Job ("Add DPF cleaning", checked), "Add to that Job" when the Job is already on the plan, "Pick
 * the Job" for a new code, and "Not now" with a reason.
 */
export function WorkPlanFaultRecommendations({
  items,
  messages,
  disabled,
  checkedFaultIds,
  pickingFaultId,
  onToggleSuggested,
  onPick,
  onCancelPick,
  onLink,
  onDismiss,
  error,
}: {
  items: TruckFaultRecommendationDto[];
  messages: AdminMessages;
  disabled: boolean;
  checkedFaultIds: ReadonlySet<string>;
  pickingFaultId: string | null;
  onToggleSuggested: (item: TruckFaultRecommendationDto) => void;
  onPick: (item: TruckFaultRecommendationDto) => void;
  onCancelPick: () => void;
  onLink: (item: TruckFaultRecommendationDto) => Promise<void>;
  onDismiss: (item: TruckFaultRecommendationDto, reason: string) => Promise<void>;
  error: string | null;
}) {
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  if (!items.length) return null;

  const reasonBadge = (item: TruckFaultRecommendationDto) => item.reason === 'stop_light'
    ? <Badge variant="destructive"><OctagonAlert aria-hidden="true" className="size-3.5" />{messages.faultRecReasonStop}</Badge>
    : item.reason === 'warning_light'
      ? <Badge variant="warning"><TriangleAlert aria-hidden="true" className="size-3.5" />{messages.faultRecReasonWarning}</Badge>
      : <Badge variant="warning">{messages.faultRecReasonCheck}</Badge>;

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3" aria-labelledby="fault-rec-title" data-testid="fault-recommendations">
      <div>
        <p id="fault-rec-title" className="font-medium text-primary">{messages.faultRecTitle}</p>
        <p className="text-xs text-muted-foreground">{messages.faultRecHint}</p>
      </div>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <ul className="divide-y rounded-md border bg-card">
        {items.map((item) => {
          const id = item.fault.id;
          const checked = checkedFaultIds.has(id);
          return (
            <li key={id} className={cn('space-y-2 px-3 py-2.5', pickingFaultId === id && 'bg-accent')} data-testid="fault-recommendation">
              <div className="flex items-start gap-3">
                {item.suggestedJob && !item.existingJob ? (
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0"
                    checked={checked}
                    disabled={disabled}
                    aria-label={fillPlaceholders(messages.faultRecAddJob, { job: item.suggestedJob.displayName })}
                    onChange={() => onToggleSuggested(item)}
                  />
                ) : <span className="w-4 shrink-0" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {reasonBadge(item)}
                    {item.stillAfter ? <span className="text-xs text-warning-foreground">{fillPlaceholders(messages.faultRecStillAfter, { wo: item.stillAfter.displayId })}</span> : null}
                  </div>
                  <p className="mt-1 text-sm font-medium">{item.fault.description}</p>
                  <p className="font-mono text-xs text-muted-foreground">{item.fault.code}</p>
                  {item.suggestedJob && !item.existingJob ? (
                    <p className="mt-1 text-sm">{fillPlaceholders(messages.faultRecAddJob, { job: item.suggestedJob.displayName })} <span className="text-xs text-muted-foreground">· {item.suggestedJob.categoryName}</span></p>
                  ) : null}
                  {item.existingJob ? <p className="mt-1 text-sm text-muted-foreground">{fillPlaceholders(messages.faultRecOnPlan, { job: item.existingJob.displayName })}</p> : null}
                  {!item.suggestedJob && pickingFaultId !== id && !checked ? <p className="mt-1 text-sm text-muted-foreground">{messages.faultRecNewCode}</p> : null}
                  {pickingFaultId === id ? <p className="mt-1 text-sm text-primary" role="status">{fillPlaceholders(messages.faultRecPicking, { code: item.fault.code })}</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {item.existingJob ? (
                  <Button type="button" size="sm" variant="outline" disabled={disabled || busy === id} onClick={() => void run(id, () => onLink(item))}>
                    <Link2 aria-hidden="true" />{messages.faultRecLink}
                  </Button>
                ) : null}
                {!item.suggestedJob && !item.existingJob && !checked ? (
                  pickingFaultId === id
                    ? <Button type="button" size="sm" variant="ghost" onClick={onCancelPick}>{messages.faultRecCancelPick}</Button>
                    : <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onPick(item)}>{messages.faultRecPick}</Button>
                ) : null}
                {dismissing === id ? null : (
                  <Button type="button" size="sm" variant="ghost" disabled={disabled || busy === id} onClick={() => { setDismissing(id); setReason(''); }}>{messages.faultRecDismiss}</Button>
                )}
              </div>
              {dismissing === id ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!reason.trim()) return;
                    void run(id, async () => { await onDismiss(item, reason.trim()); setDismissing(null); });
                  }}
                >
                  <label className="min-w-0 flex-1 text-xs">
                    <span className="mb-1 block text-muted-foreground">{messages.faultRecDismissReason}</span>
                    <Input value={reason} maxLength={300} placeholder={messages.faultRecDismissPlaceholder} onChange={(event) => setReason(event.target.value)} autoFocus />
                  </label>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setDismissing(null)}>{messages.cancel}</Button>
                  <Button type="submit" size="sm" variant="outline" disabled={!reason.trim() || busy === id}>{messages.faultRecDismissConfirm}</Button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
