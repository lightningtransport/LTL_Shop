'use client';

import { useState } from 'react';
import { formatCents, type AdminJobTireDto, type AdminWorkOrderJobDto, type TireType } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { partsCostsFailure } from './admin-parts-catalog';
import { MissingSummary, RequiredNote, focusField, type MissingField } from './parts-costs-form-ui';
import { Badge, Button, DialogActions, InlineAlert, Label, Modal, Select } from './ui';
import { confirmAdminJobTires, useAdminPartsCatalog, useAdminStock } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

type Choice = { tireType: TireType; partId: string };

/**
 * D45 / ST-4 (LTR-224): the Manager confirms the tires the inspection proposed on a Tires Job. Steer is always New;
 * drive comes as Recap and can be made New. The tire is picked from the catalog (the size last put on that axle comes
 * first); with one on the shelf it leaves the stock now, with none it stays "to buy" and can be taken here later.
 */
export function JobTiresDialog({ job, locale, messages, onClose, onChanged }: {
  job: AdminWorkOrderJobDto;
  locale: AdminLocale;
  messages: AdminMessages;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useActionToast();
  const { data: catalog } = useAdminPartsCatalog('kind=tire');
  const { data: stock, mutate: mutateStock } = useAdminStock('kind=tire');
  const tires = job.tires ?? [];
  const open = tires.filter((tire) => tire.status !== 'issued');
  const [choices, setChoices] = useState<Record<string, Choice>>(() => Object.fromEntries(open.map((tire) => [tire.id, { tireType: tire.tireType, partId: tire.part?.id ?? '' }])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const onHand = new Map((stock?.items ?? []).map((item) => [item.partId, Number(item.onHand)]));
  const tireParts = (catalog?.categories ?? []).flatMap((category) => category.parts).filter((part) => part.active);

  function options(tire: AdminJobTireDto, tireType: TireType) {
    return tireParts
      .filter((part) => part.tireType === tireType)
      .sort((left, right) => Number(right.tireSize === tire.suggestedSize) - Number(left.tireSize === tire.suggestedSize) || (onHand.get(right.id) ?? 0) - (onHand.get(left.id) ?? 0));
  }

  const ready = open.length > 0 && open.every((tire) => choices[tire.id]?.partId);
  // LTR-293 §3: what stops "Confirm tires" (same rule as ready): each open position needs a tire.
  const missing: MissingField[] = open.filter((tire) => !choices[tire.id]?.partId).map((tire) => ({ label: tire.position, fieldId: `tire-part-${tire.id}` }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !open.length) return;
    if (!ready) {
      setShowErrors(true);
      if (missing[0]) focusField(missing[0].fieldId);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await confirmAdminJobTires(job.id, { tires: open.map((tire) => ({ position: tire.position as never, ...choices[tire.id] })) });
      showToast('success', fillPlaceholders(messages.pcTiresConfirmed, { issued: String(result.issued), toBuy: String(result.toBuy) }));
      void mutateStock();
      onChanged();
      onClose();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = (status: AdminJobTireDto['status']) => (status === 'issued' ? messages.pcTireIssued : status === 'to_buy' ? messages.pcTireToBuy : messages.pcTireProposed);

  return (
    <Modal open title={fillPlaceholders(messages.pcTiresTitle, { job: job.displayName })} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!busy}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)} data-testid="job-tires-dialog" noValidate>
        <p className="text-sm text-muted-foreground">{messages.pcTiresHelp}</p>
        {showErrors && missing.length > 1 ? <MissingSummary missing={missing} messages={messages} /> : null}
        <ul className="space-y-3">
          {tires.map((tire) => {
            const choice = choices[tire.id];
            const editable = tire.status !== 'issued';
            const list = choice ? options(tire, choice.tireType) : [];
            const partMissing = showErrors && editable && choice !== undefined && !choice.partId;
            return (
              <li key={tire.id} className="space-y-2 rounded-lg border p-3" data-testid="job-tire-row">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {tire.position}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {tire.axle === 'steer' ? messages.pcTireSteer : messages.pcTireDrive}
                      {tire.reading ? ` · ${tire.reading.psi} PSI · ${tire.reading.tread}/32` : ''}
                    </span>
                  </p>
                  <Badge variant="secondary">{statusLabel(tire.status)}</Badge>
                </div>
                {editable && choice ? (
                  <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                    <fieldset className="flex items-center gap-3">
                      <legend className="sr-only">{messages.pcTireType}</legend>
                      {(['new', 'recap'] as const).map((value) => (
                        <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`tire-type-${tire.id}`}
                            checked={choice.tireType === value}
                            // Steer is always New (owner's rule).
                            disabled={busy || (tire.axle === 'steer' && value === 'recap')}
                            onChange={() => setChoices((current) => ({ ...current, [tire.id]: { tireType: value, partId: '' } }))}
                          />
                          {value === 'new' ? messages.pcTireNew : messages.pcTireRecap}
                        </label>
                      ))}
                    </fieldset>
                    <div className="space-y-1">
                      <Label htmlFor={`tire-part-${tire.id}`} className="sr-only">{messages.pcStockIssuePart}</Label>
                      <Select id={`tire-part-${tire.id}`} value={choice.partId} disabled={busy} aria-invalid={partMissing || undefined} aria-describedby={partMissing ? `tire-part-${tire.id}-error` : undefined} onChange={(event) => setChoices((current) => ({ ...current, [tire.id]: { ...choice, partId: event.target.value } }))}>
                        <option value="">{messages.pcStockIssuePick}</option>
                        {list.map((part) => (
                          <option key={part.id} value={part.id}>
                            {[part.displayName, part.tireSize, fillPlaceholders(messages.pcTireOnShelf, { qty: String(onHand.get(part.id) ?? 0) })].filter(Boolean).join(' · ')}
                          </option>
                        ))}
                      </Select>
                      <RequiredNote show={partMissing} id={`tire-part-${tire.id}-error`} messages={messages} />
                      {tire.suggestedSize ? <p className="text-xs text-muted-foreground">{fillPlaceholders(messages.pcTireSuggested, { size: tire.suggestedSize })}</p> : null}
                      {choice.partId && !(onHand.get(choice.partId) ?? 0) ? <p className="text-xs text-warning-foreground dark:text-warning">{messages.pcTireWillBeToBuy}</p> : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {[tire.part?.displayName, tire.part?.tireSize, tire.valueCents !== undefined ? formatCents(tire.valueCents, locale) : null].filter(Boolean).join(' · ')}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {catalog && !tireParts.length ? <InlineAlert>{messages.pcTireNoCatalog}</InlineAlert> : null}
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.closeDialog}</Button>
          {/* LTR-293 §3: stays on (off only while saving, or with no tires in the catalog — that already says so above);
              a position with no tire picked says "Required" under it. */}
          {open.length ? <Button type="submit" disabled={busy || Boolean(catalog && !tireParts.length)}>{messages.pcTiresConfirm}</Button> : null}
        </DialogActions>
      </form>
    </Modal>
  );
}
