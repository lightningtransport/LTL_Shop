'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { InspectionSection, type InspectionChecklistDto, type InspectionTireLimits } from '@ltl-shop/shared';
import { ArrowDown, ArrowUp, CircleAlert, CircleDot, Lock, MessageSquare, MoreHorizontal, Pencil, Plus, Power, Wrench } from 'lucide-react';
import { ApiError } from '@/lib/api';
import type { AdminLocale } from '@/lib/admin-messages';
import { inspectionCopy, type InspectionCopy } from '@/lib/inspection-copy';
import { saveInspectionChecklist, useInspectionChecklist } from '@/lib/inspection-data';
import { useUnsavedChangesGuard } from '@/lib/use-unsaved-changes-guard';
import { cn } from '@/lib/utils';
import { useActionToast } from './action-toast';
import { useAdminBreadcrumb } from './admin-breadcrumb';
import { ResponsiveMenu, type MenuItem } from './responsive-menu';
import { Badge, Button, CountChip, DialogActions, Input, Label, LoadFailure, Modal, PageHeader, PageSkeleton, SectionCard, Select } from './ui';

/**
 * D41 / HU-M17: Setup → Inspection checklist (mockup "Setup" state). The Manager and the System Admin add, rename,
 * re-point, reorder and deactivate checks and set the tire limits; everything is saved at once ("Unsaved changes").
 * Checks are never deleted, and saved inspections keep a copy of what they used.
 */
type Row = {
  key: string;
  id?: string;
  section: InspectionSection;
  label: string;
  catalogJobId: string | null;
  workflowStepKey: 'detailing' | null;
  active: boolean;
};

const SECTIONS: Array<{ key: InspectionSection; label: (copy: InspectionCopy) => string }> = [
  { key: InspectionSection.INTERIOR, label: (copy) => copy.sectionInterior },
  { key: InspectionSection.ENGINE, label: (copy) => copy.sectionEngine },
  { key: InspectionSection.EXTERIOR, label: (copy) => copy.sectionExterior },
];

const DETAILING = '__detailing';

function rowsOf(data: InspectionChecklistDto): Row[] {
  return data.items.map((item) => ({
    key: item.id,
    id: item.id,
    section: item.section,
    label: item.label,
    catalogJobId: item.catalogJob?.id ?? null,
    workflowStepKey: item.workflowStepKey === 'detailing' ? 'detailing' : null,
    active: item.active,
  }));
}

type Dialog = { kind: 'add'; section: InspectionSection } | { kind: 'rename'; key: string } | { kind: 'job'; key: string } | null;

export function AdminInspectionChecklist({ locale, leaveConfirm }: { locale: AdminLocale; leaveConfirm: string }) {
  const copy = inspectionCopy(locale);
  const { data, error, isLoading, mutate } = useInspectionChecklist();
  const { showToast } = useActionToast();
  useAdminBreadcrumb([{ label: copy.setupTitle }]);
  const [rows, setRows] = useState<Row[]>([]);
  const [limits, setLimits] = useState<InspectionTireLimits | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setRows(rowsOf(data));
    setLimits(data.limits);
  }, [data]);

  const dirty = useMemo(() => Boolean(data && limits && (JSON.stringify(rows) !== JSON.stringify(rowsOf(data)) || JSON.stringify(limits) !== JSON.stringify(data.limits))), [data, rows, limits]);
  useUnsavedChangesGuard(dirty, leaveConfirm);

  if (isLoading && !data) return <PageSkeleton label={copy.setupTitle} />;
  if (error || !data || !limits) return <LoadFailure message={copy.loadFailed} retryLabel={copy.retry} onRetry={() => void mutate()} />;

  const canEdit = data.canEdit;
  const jobOf = (id: string | null) => data.catalogJobs.find((job) => job.id === id) ?? data.items.find((item) => item.catalogJob?.id === id)?.catalogJob ?? null;
  const inactiveJobs = rows.filter((row) => row.active && row.catalogJobId && !data.catalogJobs.some((job) => job.id === row.catalogJobId)).length;

  const update = (key: string, patch: Partial<Row>) => setRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  function move(key: string, delta: -1 | 1) {
    const row = rows.find((item) => item.key === key)!;
    const same = rows.filter((item) => item.section === row.section);
    const index = same.indexOf(row);
    const other = same[index + delta];
    if (!other) return;
    const next = [...rows];
    const a = next.indexOf(row);
    const b = next.indexOf(other);
    [next[a], next[b]] = [next[b], next[a]];
    setRows(next);
  }

  async function save() {
    setPending(true);
    setFailure(null);
    try {
      const ordered = SECTIONS.flatMap((section) => rows.filter((row) => row.section === section.key));
      const next = await saveInspectionChecklist({
        items: ordered.map((row) => ({ ...(row.id ? { id: row.id } : {}), section: row.section, label: row.label, catalogJobId: row.catalogJobId, workflowStepKey: row.workflowStepKey, active: row.active })),
        limits: limits!,
      });
      await mutate(next, { revalidate: false });
      showToast('success', copy.checklistSaved);
    } catch (problem) {
      const message = problem instanceof ApiError && problem.body && typeof problem.body === 'object' && 'message' in problem.body && typeof (problem.body as { message: unknown }).message === 'string'
        ? (problem.body as { message: string }).message
        : copy.checklistSaveFailed;
      setFailure(message);
    } finally {
      setPending(false);
    }
  }

  const sectionLabel = (key: InspectionSection) => SECTIONS.find((section) => section.key === key)!.label(copy);
  const limitField = (field: keyof InspectionTireLimits, label: string) => (
    <label className="space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        className="tnum"
        disabled={!canEdit}
        value={limits[field]}
        onChange={(event) => setLimits({ ...limits, [field]: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
      />
    </label>
  );

  return (
    <div className={cn('space-y-6', dirty && 'pb-24')}>
      <PageHeader title={copy.setupTitle} subtitle={copy.setupIntro} />
      {!canEdit ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock aria-hidden="true" className="size-3.5" />{copy.readOnlyChecklist}</p> : null}
      {inactiveJobs ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-surface/60 px-4 py-3 text-warning-foreground dark:text-warning">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{copy.inactiveJobWarning(inactiveJobs)}
        </p>
      ) : null}
      {failure ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive-text">{failure}</p> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {SECTIONS.map((section) => {
            const list = rows.filter((row) => row.section === section.key);
            return (
              <SectionCard
                key={section.key}
                title={section.label(copy)}
                count={list.filter((row) => row.active).length}
                action={canEdit ? <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ kind: 'add', section: section.key })}><Plus aria-hidden="true" />{copy.addCheck}</Button> : null}
                data-testid={`checklist-section-${section.key}`}
              >
                <ul className="divide-y">
                  {list.map((row, index) => {
                    const job = jobOf(row.catalogJobId);
                    const items: MenuItem[] = [
                      { key: 'rename', label: copy.rename, icon: Pencil, onSelect: () => setDialog({ kind: 'rename', key: row.key }) },
                      { key: 'job', label: copy.changeJob, icon: Wrench, onSelect: () => setDialog({ kind: 'job', key: row.key }) },
                      ...(index > 0 ? [{ key: 'up', label: copy.moveUp, icon: ArrowUp, onSelect: () => move(row.key, -1) }] : []),
                      ...(index < list.length - 1 ? [{ key: 'down', label: copy.moveDown, icon: ArrowDown, onSelect: () => move(row.key, 1) }] : []),
                      { key: 'active', label: row.active ? copy.deactivate : copy.activate, icon: Power, onSelect: () => update(row.key, { active: !row.active }), separatorBefore: true, destructive: row.active },
                    ];
                    return (
                      <li key={row.key} className={cn('flex min-h-12 items-center gap-2 px-3 py-1.5 sm:px-4', !row.active && 'bg-sunken/60')} data-testid="checklist-row">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn(!row.active && 'text-muted-foreground line-through decoration-1')}>{row.label}</span>
                            {!row.id ? <Badge variant="default">{copy.newBadge}</Badge> : null}
                            {!row.active ? <Badge variant="secondary">{copy.inactiveBadge}</Badge> : null}
                          </div>
                          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                            {row.workflowStepKey ? <MessageSquare aria-hidden="true" className="size-3.5 shrink-0" /> : <Wrench aria-hidden="true" className="size-3.5 shrink-0" />}
                            <span className="truncate">{row.workflowStepKey ? copy.noteOnDetailing : job ? `${job.displayName} · ${job.categoryName}` : '—'}</span>
                          </p>
                        </div>
                        {canEdit ? (
                          <ResponsiveMenu
                            label={row.label}
                            items={items}
                            trigger={<Button type="button" variant="ghost" size="icon" aria-label={copy.moreFor(row.label)}><MoreHorizontal aria-hidden="true" /></Button>}
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            );
          })}
          <p className="text-xs text-muted-foreground">{copy.applyNote}</p>
        </div>

        <div className="space-y-6 lg:sticky lg:top-20">
          <SectionCard title={<><CircleDot aria-hidden="true" className="size-4" />{copy.tiresLimitsTitle}</>}>
            <div className="space-y-4 p-4">
              <p className="text-muted-foreground">{copy.tiresLimitsHint}</p>
              <div className="grid grid-cols-2 gap-3">
                {limitField('steerTargetPsi', copy.steerPsi)}
                {limitField('driveTargetPsi', copy.drivePsi)}
                {limitField('steerMinTread', copy.steerMinTread)}
                {limitField('driveMinTread', copy.driveMinTread)}
                {limitField('watchPct', copy.watchPct)}
                {limitField('fixPct', copy.fixPct)}
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li><span className="font-medium text-success">{copy.ruleOk}</span></li>
                <li><span className="font-medium text-warning-foreground dark:text-warning">{copy.ruleWatch}</span></li>
                <li><span className="font-medium text-destructive-text">{copy.ruleFix}</span></li>
              </ul>
            </div>
          </SectionCard>
          <SectionCard title={copy.whoCanInspectTitle}>
            <div className="space-y-2 p-4">
              <p>{copy.whoCanInspectText}</p>
              <Link href="/admin/mechanics" className="text-sm font-medium text-primary hover:underline">{copy.openPeople}</Link>
            </div>
          </SectionCard>
        </div>
      </div>

      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur app-safe-bottom lg:left-[var(--admin-aside)]" data-testid="checklist-unsaved">
          <div className="mx-auto flex max-w-[1440px] items-center justify-end gap-2 px-4 py-3 md:px-6">
            <span className="mr-auto text-sm font-medium" role="status">{copy.unsaved}</span>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => { setRows(rowsOf(data)); setLimits(data.limits); setFailure(null); }}>{copy.discard}</Button>
            <Button type="button" disabled={pending} onClick={() => void save()} data-testid="checklist-save">{pending ? copy.saving : copy.saveChanges}</Button>
          </div>
        </div>
      ) : null}

      {dialog ? (
        <CheckDialog
          copy={copy}
          dialog={dialog}
          row={dialog.kind === 'add' ? null : rows.find((row) => row.key === dialog.key) ?? null}
          sectionLabel={dialog.kind === 'add' ? sectionLabel(dialog.section) : ''}
          jobs={data.catalogJobs}
          onClose={() => setDialog(null)}
          onDone={(value) => {
            if (dialog.kind === 'add') {
              const target = value.target === DETAILING ? { catalogJobId: null, workflowStepKey: 'detailing' as const } : { catalogJobId: value.target, workflowStepKey: null };
              const last = rows.map((row) => row.section).lastIndexOf(dialog.section);
              const row: Row = { key: `new-${Date.now()}`, section: dialog.section, label: value.label, active: true, ...target };
              setRows([...rows.slice(0, last + 1), row, ...rows.slice(last + 1)]);
            } else if (dialog.kind === 'rename') update(dialog.key, { label: value.label });
            else update(dialog.key, value.target === DETAILING ? { catalogJobId: null, workflowStepKey: 'detailing' } : { catalogJobId: value.target, workflowStepKey: null });
            setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CheckDialog({
  copy,
  dialog,
  row,
  sectionLabel,
  jobs,
  onClose,
  onDone,
}: {
  copy: InspectionCopy;
  dialog: NonNullable<Dialog>;
  row: Row | null;
  sectionLabel: string;
  jobs: InspectionChecklistDto['catalogJobs'];
  onClose: () => void;
  onDone: (value: { label: string; target: string }) => void;
}) {
  const [label, setLabel] = useState(row?.label ?? '');
  const [target, setTarget] = useState(row ? (row.workflowStepKey ? DETAILING : row.catalogJobId ?? '') : '');
  const categories = useMemo(() => [...new Set(jobs.map((job) => job.categoryName))], [jobs]);
  const showLabel = dialog.kind !== 'job';
  const showTarget = dialog.kind !== 'rename';
  const valid = (!showLabel || label.trim().length > 0) && (!showTarget || target !== '');
  const title = dialog.kind === 'add' ? copy.addCheckTitle(sectionLabel) : dialog.kind === 'rename' ? copy.renameTitle : copy.changeJobTitle(row?.label ?? '');
  return (
    <Modal open title={title} description={dialog.kind === 'add' ? copy.addCheckSub(sectionLabel) : undefined} onClose={onClose} closeLabel={copy.close}>
      <form
        className="space-y-4"
        onSubmit={(event) => { event.preventDefault(); if (valid) onDone({ label: label.trim(), target }); }}
      >
        {showLabel ? (
          <div className="space-y-1.5">
            <Label htmlFor="check-label">{copy.checkName}</Label>
            <Input id="check-label" value={label} maxLength={120} placeholder={copy.checkNamePlaceholder} onChange={(event) => setLabel(event.target.value)} />
          </div>
        ) : null}
        {showTarget ? (
          <div className="space-y-1.5">
            <Label htmlFor="check-target">{copy.defectCreates}</Label>
            <Select id="check-target" value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="" disabled>—</option>
              <option value={DETAILING}>{copy.detailingOption}</option>
              {categories.map((category) => (
                <optgroup key={category} label={category}>
                  {jobs.filter((job) => job.categoryName === category).map((job) => <option key={job.id} value={job.id}>{job.displayName}</option>)}
                </optgroup>
              ))}
            </Select>
          </div>
        ) : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose}>{copy.cancel}</Button>
          <Button type="submit" disabled={!valid}>{dialog.kind === 'add' ? copy.addCheck : copy.done}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}
