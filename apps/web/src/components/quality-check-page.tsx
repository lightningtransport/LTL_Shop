'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSWRConfig } from 'swr';
import {
  CalendarClock, Check, CheckCheck, CircleAlert, ClipboardCheck, Ellipsis, Hand, HandHelping, History, Plus, RotateCw, Undo2, X,
} from 'lucide-react';
import { AppCapability } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useAuth } from '@/lib/auth-context';
import { useShopLocale } from '@/lib/locale-context';
import { replaceAppLocation } from '@/lib/session-restore';
import { defaultWorkspacePath } from '@/lib/admin-routing';
import { canShowManagerWrites } from '@/lib/system-admin';
import { formatMileage, formatShopDateTime, formatVehicleYmm } from '@/lib/format';
import { formatAdminDateOnly } from '@/lib/admin-format';
import { draftKeys, useLocalDraft } from '@/lib/local-draft';
import {
  cardMechanics, qualityCheckHistoryKey, qualityCheckReviewKey, relativeTime, useQualityCheckHistory, useQualityCheckQueue,
  useQualityCheckReview, type QualityCheckItem, type QualityCheckQueue, type QualityCheckReturnedItem, type QualityCheckReview,
} from '@/lib/quality-check-data';
import { cn } from '@/lib/utils';
import { useActionToast } from './action-toast';
import { MechanicAvatar, MechanicAvatarStack } from './mechanic-avatar';
import { ResponsiveMenu } from './responsive-menu';
import { SessionSignInFallback } from './session-sign-in-fallback';
import { SideSheet } from './side-sheet';
import { OfflineStrip } from './offline-strip';
import {
  Badge, Button, CardListSkeleton, CountChip, DialogActions, HomeTopBar, InlineAlert, Input, Label, Modal, PageHeader, PriorityBadge,
  SectionCard, Select, Textarea,
} from './ui';

type Tab = 'review' | 'returned' | 'done';
/** D46 / SQ-3: one thing Safety found, with the catalog Job that fixes it when they know it. */
type FindingDraft = { key: string; text: string; catalogJobId: string };
const newFinding = (): FindingDraft => ({ key: crypto.randomUUID(), text: '', catalogJobId: '' });
const sendable = (findings: FindingDraft[]) => findings
  .filter((finding) => finding.text.trim())
  .map((finding) => ({ text: finding.text.trim(), ...(finding.catalogJobId ? { catalogJobId: finding.catalogJobId } : {}) }));
type Action = 'take' | 'approve' | 'return' | 'release';
const OTHER = '__other__';

/**
 * LTR-185 / D19, Safety redesign (docs/proposals/qc-screen-redesign, D-QC1…D-QC7): the trucks to review,
 * most urgent first; a review of each truck with what was done; Approve with a confirmation; Return with the
 * Job that failed; Let go; and the Returned and Done tabs.
 */
export function QualityCheckPage() {
  const { user, token, sessionLoading } = useAuth();
  const { messages } = useShopLocale();
  const { showToast } = useActionToast();
  const { mutate: mutateGlobal } = useSWRConfig();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tab: Tab = search.get('tab') === 'returned' ? 'returned' : search.get('tab') === 'done' ? 'done' : 'review';
  const isSafety = !!user?.capabilities.includes(AppCapability.QUALITY_CHECK_PERFORM);
  // LTR-197 / D29: the Shop Manager and the System Admin use this screen as Safety's backup.
  const isBackup = !isSafety && canShowManagerWrites(user?.role, user);
  const canPerform = isSafety || isBackup;
  const { data, error, mutate } = useQualityCheckQueue(!!token && canPerform);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnJob, setReturnJob] = useState<string | null>(null);
  // Block A (Q9): the return note is a draft per truck, kept on this phone until the truck is returned.
  const [note, setNote, clearNote] = useLocalDraft(returning && openId ? draftKeys.qcReturn(openId) : null);
  const [noteError, setNoteError] = useState(false);
  // D46 / SQ-3: findings on return (they hold the truck) and on approve (they do not).
  const [returnFindings, setReturnFindings] = useState<FindingDraft[]>([]);
  const [approveFindings, setApproveFindings] = useState<FindingDraft[]>([]);
  const { data: openReview } = useQualityCheckReview(returning || confirmApprove ? openId : null);
  const reviewTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!sessionLoading && !token) replaceAppLocation('/login', router);
    if (!sessionLoading && token && user && !canPerform) replaceAppLocation(defaultWorkspacePath(user), router);
  }, [sessionLoading, token, user, canPerform, router]);
  if (!sessionLoading && !token) return <SessionSignInFallback />;

  const t = messages.qc;
  const pending = data?.pending ?? [];
  const returned = data?.returned ?? [];
  const openItem = pending.find((item) => item.workOrderId === openId) ?? null;

  async function run(item: QualityCheckItem, action: Action, body?: Record<string, unknown>) {
    setBusy(action);
    setActionError(null);
    try {
      const next = await apiFetch<QualityCheckQueue>(`/api/qc/${item.workOrderId}/${action}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
      await mutate(next, { revalidate: false });
      void mutateGlobal(qualityCheckReviewKey(item.workOrderId));
      if (action === 'approve' || action === 'return') void mutateGlobal(qualityCheckHistoryKey);
      if (action === 'take') showToast('success', t.takenToast(item.truck.truckNumber));
      if (action === 'release') showToast('success', t.letGoToast(item.truck.truckNumber));
      if (action === 'approve') {
        showToast('success', t.approved(item.truck.truckNumber));
        setConfirmApprove(false);
        setOpenId(null);
      }
      if (action === 'return') {
        showToast('success', t.returnedToast(item.truck.truckNumber));
        clearNote();
        setReturning(false);
        setOpenId(null);
      }
      return true;
    } catch (caught) {
      setActionError(apiErrorMessage(caught, messages, t.loadError));
      void mutate();
      return false;
    } finally {
      setBusy(null);
    }
  }

  function goTab(next: Tab) {
    router.replace(next === 'review' ? pathname : `${pathname}?tab=${next}`, { scroll: false });
  }

  const mineCount = pending.filter((item) => item.mine).length;
  const tabs: Array<{ key: Tab; label: string; count: number | null; Icon: typeof ClipboardCheck }> = [
    { key: 'review', label: t.tabReview, count: data ? pending.length : null, Icon: ClipboardCheck },
    { key: 'returned', label: t.tabReturned, count: data ? returned.length : null, Icon: Undo2 },
    { key: 'done', label: t.tabDone, count: null, Icon: History },
  ];

  return (
    <div>
      <HomeTopBar />
      {/* D-MG1: on phones the tabs sit at the bottom, like the mechanics'; from `sm` they stay on top. */}
      <nav
        aria-label={t.navLabel}
        data-testid="qc-tabs"
        data-bottom-tabs=""
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t bg-card pb-[var(--app-safe-bottom)] sm:static sm:mb-4 sm:gap-1 sm:rounded-xl sm:border sm:p-1"
      >
        {tabs.map(({ key, label, count, Icon }) => (
          <button
            key={key}
            type="button"
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => goTab(key)}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-0.5 whitespace-nowrap px-1.5 text-xs font-medium transition sm:min-h-11 sm:flex-row sm:gap-1.5 sm:rounded-lg sm:text-sm',
              tab === key ? 'text-primary sm:bg-primary sm:text-primary-foreground' : 'text-muted-foreground hover:text-foreground sm:hover:bg-accent',
            )}
          >
            <Icon aria-hidden="true" className="size-5 sm:size-4" />
            <span>{label}{count !== null ? <span className="tnum ml-1 opacity-80 sm:hidden">· {count}</span> : null}</span>
            {count !== null ? <span className="tnum hidden text-xs opacity-80 sm:inline">{count}</span> : null}
          </button>
        ))}
      </nav>

      {/* Block C (Q10): one notice without a connection. */}
      <OfflineStrip message={messages.offlineNotSent} />
      {isBackup && user ? (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid="qc-backup-banner">
          <p><span className="font-semibold">{t.backupTitle}</span> {t.backupBody(user.name)}</p>
          <Button asChild variant="outline" size="sm" className="shrink-0"><Link href="/admin">{t.backToAdmin}</Link></Button>
        </div>
      ) : null}
      {data && data.onTeam === false ? <p className="mb-4 rounded-xl border px-4 py-3 text-sm text-muted-foreground" data-testid="qc-not-on-team">{t.notOnTeam}</p> : null}
      {actionError && !openId ? <InlineAlert className="mb-3">{actionError}</InlineAlert> : null}

      {tab === 'done' ? (
        <DoneTab enabled={!!token && canPerform} onBack={() => goTab('review')} />
      ) : (
        <>
          <PageHeader
            className="mb-4"
            title={tab === 'returned' ? t.returnedTitle : t.title}
            subtitle={tab === 'returned' ? t.returnedHint : t.subtitle}
          />
          {error ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-8 text-center" role="alert">
              <CircleAlert aria-hidden="true" className="size-5 text-destructive-text" />
              <p className="font-medium">{t.loadError}</p>
              <p className="text-sm text-muted-foreground">{t.loadErrorHint}</p>
              <Button variant="outline" className="mt-2" onClick={() => void mutate()}><RotateCw aria-hidden="true" />{messages.retry}</Button>
            </div>
          ) : null}
          {!data && !error ? <CardListSkeleton /> : null}
          {data && tab === 'review' ? (
            pending.length ? (
              <>
                <p className="mb-2 text-xs text-muted-foreground" data-testid="qc-count">{t.toReview(pending.length, mineCount)}</p>
                <ul className="space-y-2" aria-label={t.tabReview}>
                  {pending.map((item) => (
                    <QueueCard
                      key={item.workOrderId}
                      item={item}
                      busy={busy !== null}
                      onOpen={(trigger) => { reviewTriggerRef.current = trigger; setActionError(null); setOpenId(item.workOrderId); }}
                      onTake={async (trigger) => {
                        reviewTriggerRef.current = trigger;
                        if (await run(item, 'take')) setOpenId(item.workOrderId);
                      }}
                    />
                  ))}
                </ul>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground" data-testid="qc-empty">
                <CheckCheck aria-hidden="true" className="size-5 text-success" />
                <p className="font-medium text-foreground">{t.empty}</p>
                <p>{t.emptyHint}</p>
                <Button variant="ghost" className="mt-1" onClick={() => goTab('done')}><History aria-hidden="true" />{t.tabDone}</Button>
              </div>
            )
          ) : null}
          {data && tab === 'returned' ? <ReturnedTab items={returned} /> : null}
        </>
      )}

      <ReviewSheet
        item={openItem}
        busy={busy}
        actionError={actionError}
        onClose={() => { if (!busy) { setOpenId(null); setActionError(null); } }}
        onTake={() => openItem && void run(openItem, 'take')}
        onRelease={() => openItem && void run(openItem, 'release')}
        onApprove={() => { setApproveFindings([]); setConfirmApprove(true); }}
        onReturn={() => { setReturnJob(null); setNoteError(false); setReturnFindings([newFinding()]); setReturning(true); }}
      />

      <Modal
        open={confirmApprove && !!openItem}
        title={openItem ? t.approveTitle(openItem.truck.truckNumber) : t.approve}
        description={openItem ? t.approveHint(openItem.displayId) : undefined}
        closeLabel={messages.closeDialog}
        onClose={() => { if (!busy) setConfirmApprove(false); }}
      >
        <FindingsEditor
          label={t.approveFindingsLabel}
          hint={t.approveFindingsHint}
          findings={approveFindings}
          onChange={setApproveFindings}
          catalogJobs={openReview?.catalogJobs ?? []}
          disabled={busy !== null}
        />
        {actionError && confirmApprove ? <InlineAlert className="mt-2">{actionError}</InlineAlert> : null}
        <DialogActions className="mt-4">
          <Button variant="outline" disabled={busy !== null} onClick={() => setConfirmApprove(false)}>{t.back}</Button>
          <Button disabled={busy !== null} onClick={() => openItem && void run(openItem, 'approve', sendable(approveFindings).length ? { findings: sendable(approveFindings) } : undefined)} data-testid="qc-confirm-approve">
            <CheckCheck aria-hidden="true" />{t.approve}
          </Button>
        </DialogActions>
      </Modal>

      <Modal
        open={returning && !!openItem}
        title={openItem ? t.returnTitle(openItem.truck.truckNumber) : t.returnTruck}
        description={t.returnHint}
        closeLabel={messages.closeDialog}
        onClose={() => { if (!busy) setReturning(false); }}
      >
        {openItem ? (
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-medium">{t.whichJob} <span className="font-normal text-muted-foreground">{t.optional}</span></legend>
            <div className="flex flex-wrap gap-1.5">
              {[...(openItem.doneBy ?? []).map((entry) => ({ key: entry.jobId, label: entry.job })), { key: OTHER, label: t.otherJob }].map((choice) => (
                <button
                  key={choice.key}
                  type="button"
                  aria-pressed={returnJob === choice.key}
                  onClick={() => setReturnJob(returnJob === choice.key ? null : choice.key)}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-full border px-3 text-sm [@media(pointer:fine)]:min-h-9',
                    returnJob === choice.key ? 'border-primary bg-primary/15 text-primary-text' : 'hover:bg-accent',
                  )}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        <Label className="mb-2 block" htmlFor="qc-return-note">{t.returnNoteLabel}</Label>
        <Textarea
          id="qc-return-note"
          value={note}
          placeholder={t.returnPlaceholder}
          disabled={busy !== null}
          aria-invalid={noteError || undefined}
          aria-describedby={noteError ? 'qc-return-note-error' : undefined}
          onChange={(event) => { setNote(event.target.value); setNoteError(false); }}
        />
        <div className="mt-4">
          <FindingsEditor
            label={t.findingsLabel}
            hint={t.findingsHint}
            findings={returnFindings}
            onChange={(next) => { setReturnFindings(next); setNoteError(false); }}
            catalogJobs={openReview?.catalogJobs ?? []}
            disabled={busy !== null}
          />
        </div>
        {noteError ? <p id="qc-return-note-error" className="mt-2 text-sm text-destructive-text" role="alert">{t.returnNeedsSomething}</p> : null}
        {actionError && returning ? <InlineAlert className="mt-2">{actionError}</InlineAlert> : null}
        <DialogActions className="mt-4">
          <Button variant="outline" disabled={busy !== null} onClick={() => setReturning(false)}>{t.back}</Button>
          <Button
            disabled={busy !== null}
            onClick={() => {
              const findings = sendable(returnFindings);
              if (!note.trim() && !findings.length) { setNoteError(true); return; }
              if (openItem) void run(openItem, 'return', { ...(note.trim() ? { notes: note.trim() } : {}), ...(returnJob && returnJob !== OTHER ? { jobId: returnJob } : {}), ...(findings.length ? { findings } : {}) });
            }}
          >
            <Undo2 aria-hidden="true" />{t.returnConfirm}
          </Button>
        </DialogActions>
      </Modal>
    </div>
  );
}

/**
 * D46 / SQ-3: what Safety found, one row per thing: the text, and the catalog Job when Safety knows it. The Manager
 * turns each one into work. Never shows or sends who wrote it to the Shop.
 */
function FindingsEditor({ label, hint, findings, onChange, catalogJobs, disabled }: {
  label: string;
  hint: string;
  findings: FindingDraft[];
  onChange: (next: FindingDraft[]) => void;
  catalogJobs: Array<{ id: string; displayName: string; categoryName: string }>;
  disabled: boolean;
}) {
  const { messages } = useShopLocale();
  const t = messages.qc;
  const categories = [...new Set(catalogJobs.map((job) => job.categoryName))];
  const update = (key: string, patch: Partial<FindingDraft>) => onChange(findings.map((finding) => (finding.key === key ? { ...finding, ...patch } : finding)));
  return (
    <fieldset className="space-y-2" data-testid="qc-findings">
      <legend className="text-sm font-medium">{label} <span className="font-normal text-muted-foreground">{t.optional}</span></legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {findings.map((finding, index) => (
        <div key={finding.key} className="space-y-1.5 rounded-lg border p-2" data-testid="qc-finding">
          <div className="flex items-start gap-2">
            <Input
              aria-label={`${label} ${index + 1}`}
              value={finding.text}
              placeholder={t.findingPlaceholder}
              disabled={disabled}
              maxLength={300}
              onChange={(event) => update(finding.key, { text: event.target.value })}
            />
            <Button type="button" variant="ghost" size="sm" aria-label={t.removeFinding} disabled={disabled} onClick={() => onChange(findings.filter((item) => item.key !== finding.key))}>
              <X aria-hidden="true" />
            </Button>
          </div>
          <Select aria-label={`${t.findingJob} ${index + 1}`} value={finding.catalogJobId} disabled={disabled} onChange={(event) => update(finding.key, { catalogJobId: event.target.value })}>
            <option value="">{t.findingJob}: {t.findingNoJob}</option>
            {categories.map((category) => (
              <optgroup key={category} label={category}>
                {catalogJobs.filter((job) => job.categoryName === category).map((job) => <option key={job.id} value={job.id}>{job.displayName}</option>)}
              </optgroup>
            ))}
          </Select>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled || findings.length >= 10} onClick={() => onChange([...findings, newFinding()])}>
        <Plus aria-hidden="true" />{t.addFinding}
      </Button>
    </fieldset>
  );
}

function PriorityChip({ priority }: { priority?: string }) {
  const { messages } = useShopLocale();
  if (priority !== 'critical' && priority !== 'high') return null;
  return <PriorityBadge priority={priority}>{messages.priority[priority as keyof typeof messages.priority] ?? priority}</PriorityBadge>;
}

function leavesLabel(leavesOn: string | null | undefined, locale: 'en' | 'es') {
  return leavesOn ? formatAdminDateOnly(leavesOn, locale) : null;
}

function QueueCard({
  item,
  busy,
  onOpen,
  onTake,
}: {
  item: QualityCheckItem;
  busy: boolean;
  onOpen: (trigger: HTMLButtonElement) => void;
  onTake: (trigger: HTMLButtonElement) => void;
}) {
  const { messages } = useShopLocale();
  const t = messages.qc;
  const locale = messages.locale;
  const takenByOther = Boolean(item.takenBy && !item.mine);
  const people = cardMechanics(item);
  const vehicle = formatVehicleYmm(item.truck);
  const leaves = leavesLabel(item.leavesOn, locale);
  const jobs = item.doneBy?.length ? item.doneBy.map((entry) => entry.job) : item.doneJobs;
  return (
    <li
      className={cn('rounded-xl border bg-card', item.mine && 'border-primary ring-1 ring-primary', takenByOther && 'opacity-70')}
      data-testid={`qc-card-${item.truck.truckNumber}`}
    >
      <button
        type="button"
        disabled={takenByOther}
        onClick={(event) => onOpen(event.currentTarget)}
        aria-label={messages.truckTitle(item.truck.truckNumber)}
        className={cn('block w-full space-y-1.5 rounded-t-xl p-3 text-left', takenByOther ? 'cursor-default' : 'hover:bg-accent/40')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold">{messages.truckTitle(item.truck.truckNumber)}</span>
          <PriorityChip priority={item.priority} />
          {item.mine ? <Badge variant="default">{t.yours}</Badge> : null}
          <span className="tnum ml-auto text-xs text-muted-foreground">{t.readySince(relativeTime(item.readySince, locale))}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[vehicle, item.displayId, item.location].filter(Boolean).join(' · ')}
        </p>
        {leaves ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning-foreground dark:text-warning">
            <CalendarClock aria-hidden="true" className="size-3.5" />{t.leaves(leaves)}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {jobs.map((job) => (
            <span key={job} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-xs text-muted-foreground">
              <Check aria-hidden="true" className="size-3.5 text-success" />{job}
            </span>
          ))}
        </div>
        {people.length ? (
          <div className="flex items-center gap-2 pt-0.5">
            <MechanicAvatarStack mechanics={people} max={4} />
            <span className="truncate text-xs text-muted-foreground">{people.map((person) => person.name).join(', ')}</span>
          </div>
        ) : item.mechanics.length ? <p className="text-xs text-muted-foreground">{item.mechanics.join(', ')}</p> : null}
      </button>
      <div className="border-t p-2">
        {item.mine ? (
          <Button className="w-full" onClick={(event) => onOpen(event.currentTarget)}>
            <ClipboardCheck aria-hidden="true" />{t.continueReview}
          </Button>
        ) : takenByOther ? (
          <p className="flex min-h-9 items-center gap-2 px-1 text-sm text-muted-foreground">
            <MechanicAvatar id={item.takenBy!.id} name={item.takenBy!.name} size="sm" />{t.takenBy(item.takenBy!.name)}
          </p>
        ) : (
          <Button
            className="w-full"
            disabled={busy}
            aria-label={`${t.take} · ${messages.truckTitle(item.truck.truckNumber)}`}
            onClick={(event) => onTake(event.currentTarget)}
          >
            <Hand aria-hidden="true" />{t.take}
          </Button>
        )}
      </div>
    </li>
  );
}

function ReviewSheet({
  item,
  busy,
  actionError,
  onClose,
  onTake,
  onRelease,
  onApprove,
  onReturn,
}: {
  item: QualityCheckItem | null;
  busy: Action | null;
  actionError: string | null;
  onClose: () => void;
  onTake: () => void;
  onRelease: () => void;
  onApprove: () => void;
  onReturn: () => void;
}) {
  const { messages } = useShopLocale();
  const t = messages.qc;
  const { data, error, mutate } = useQualityCheckReview(item?.workOrderId ?? null);
  const review: QualityCheckReview | undefined = data && item && data.workOrderId === item.workOrderId ? data : undefined;
  const takenByOther = Boolean(item?.takenBy && !item.mine);
  const footer = item ? (
    item.mine ? (
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={busy !== null} onClick={onReturn}><Undo2 aria-hidden="true" />{t.returnTruck}</Button>
        <Button disabled={busy !== null} onClick={onApprove} data-testid="qc-approve"><CheckCheck aria-hidden="true" />{t.approve}</Button>
      </div>
    ) : takenByOther ? (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <MechanicAvatar id={item.takenBy!.id} name={item.takenBy!.name} size="sm" />{t.reviewing(item.takenBy!.name)}
      </p>
    ) : (
      <Button className="w-full" disabled={busy !== null} onClick={onTake}><Hand aria-hidden="true" />{t.takeThisTruck}</Button>
    )
  ) : null;

  return (
    <SideSheet
      open={Boolean(item)}
      title={item ? t.reviewTitle(item.truck.truckNumber) : ''}
      description={item ? (
        <span className="flex flex-wrap items-center gap-x-2 text-xs">
          <span className="font-mono">{item.displayId}</span>
          <span>· {t.readySince(relativeTime(item.readySince, messages.locale))}</span>
          {item.mine ? (
            <span className="ml-auto">
              <ResponsiveMenu
                label={messages.truckTitle(item.truck.truckNumber)}
                trigger={<Button variant="ghost" size="sm" className="h-8 px-2" aria-label={t.more}><Ellipsis aria-hidden="true" /></Button>}
                items={[{ key: 'release', label: t.letGo, icon: HandHelping, onSelect: onRelease, testId: 'qc-let-go' }]}
                contentTestId="qc-review-menu"
              />
            </span>
          ) : null}
        </span>
      ) : undefined}
      closeLabel={messages.closeDialog}
      onClose={onClose}
      footer={footer}
      testId="qc-review"
    >
      <div className="space-y-3 p-4">
        {actionError ? <InlineAlert>{actionError}</InlineAlert> : null}
        {item && (item.priority === 'critical' || item.priority === 'high' || item.leavesOn) ? (
          <div className="flex flex-wrap items-center gap-2">
            <PriorityChip priority={item.priority} />
            {item.leavesOn ? (
              <Badge variant="warning"><CalendarClock aria-hidden="true" className="size-3.5" />{t.leaves(leavesLabel(item.leavesOn, messages.locale) ?? '')}</Badge>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <div className="space-y-2" role="alert">
            <InlineAlert>{apiErrorMessage(error, messages, t.reviewLoadError)}</InlineAlert>
            <Button variant="outline" onClick={() => void mutate()}><RotateCw aria-hidden="true" />{messages.retry}</Button>
          </div>
        ) : !review ? (
          <CardListSkeleton count={2} />
        ) : (
          <ReviewBody review={review} />
        )}
      </div>
    </SideSheet>
  );
}

function ReviewBody({ review }: { review: QualityCheckReview }) {
  const { messages } = useShopLocale();
  const t = messages.qc;
  const locale = messages.locale;
  const when = (iso: string | null) => (iso ? formatShopDateTime(iso, locale) : '—');
  return (
    <>
      <SectionCard title={t.truckSection}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 text-sm">
          <dt className="text-muted-foreground">{t.vehicle}</dt>
          <dd className="text-right font-medium">{formatVehicleYmm(review.truck) || '—'}</dd>
          <dt className="text-muted-foreground">{t.mileage}</dt>
          <dd className="tnum text-right font-medium">{formatMileage(review.truck.mileage)}</dd>
          <dt className="text-muted-foreground">{t.vin}</dt>
          <dd className="break-all text-right font-mono text-[13px]">{review.truck.vin ?? '—'}</dd>
          <dt className="text-muted-foreground">{t.where}</dt>
          <dd className="text-right font-medium">{review.location ?? <span className="font-normal text-muted-foreground">{t.notReported}</span>}</dd>
        </dl>
      </SectionCard>

      <SectionCard title={t.whatWasDone} count={review.jobs.length}>
        <ul className="divide-y" data-testid="qc-review-jobs">
          {review.jobs.map((job) => (
            <li key={job.id} className="flex gap-3 px-4 py-3">
              {job.mechanic ? <MechanicAvatar id={job.mechanic.id} name={job.mechanic.name} /> : <span className="size-7 shrink-0" />}
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-medium">{job.name}</span>
                  <span className="tnum text-xs text-muted-foreground">{when(job.completedAt)}</span>
                </p>
                <p className="text-xs text-muted-foreground">{[job.category, job.mechanic?.name].filter(Boolean).join(' · ')}</p>
                {job.isPm && review.pm ? (
                  <p className="mt-1 text-muted-foreground">{t.pmLine(formatMileage(review.pm.observedMileage), review.pm.parts.length)}</p>
                ) : null}
                {job.isPm && review.pm?.parts.length ? (
                  <ul className="mt-1 text-xs text-muted-foreground">
                    {review.pm.parts.map((part) => <li key={part.category}>{part.category}: {part.partNumber ? `${part.partNumber} — ${part.name}` : part.name}</li>)}
                  </ul>
                ) : null}
                {job.note ? <p className="mt-1 italic text-foreground/90">“{job.note}”</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title={t.inspectionSection}>
        <p className="flex items-center gap-2 px-4 py-3 text-sm">
          <ClipboardCheck aria-hidden="true" className={cn('size-4', review.inspection.outcome === 'not_recorded' ? 'text-muted-foreground' : 'text-success')} />
          {t.inspection[review.inspection.outcome]}
          {review.inspection.recordedAt ? <span className="text-xs text-muted-foreground">· {when(review.inspection.recordedAt)}</span> : null}
        </p>
        {/* D46 / SQ-2: the sheet itself — what the inspector found, the tires and the notes (read only). */}
        {review.inspection.sheet ? (
          <div className="space-y-3 border-t px-4 py-3 text-sm" data-testid="qc-inspection-sheet">
            <p className="text-xs text-muted-foreground">{t.inspectionBy(review.inspection.sheet.inspectedBy.name)}</p>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.inspectionDefects}</p>
              {review.inspection.sheet.items.some((item) => item.result === 'defect') ? (
                <ul className="mt-1 space-y-1.5">
                  {review.inspection.sheet.items.filter((item) => item.result === 'defect').map((item) => (
                    <li key={item.id}>
                      <span className="font-medium">{item.label}</span>
                      {item.catalogJobName ? <span className="text-muted-foreground"> → {item.catalogJobName}</span> : null}
                      {item.addedLater ? <span className="text-xs text-muted-foreground"> · {t.inspectionAddedLater}</span> : null}
                      {item.note ? <span className="block text-muted-foreground">“{item.note}”</span> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-muted-foreground">{t.inspectionNoDefects}</p>}
            </div>
            {review.inspection.sheet.tires.some((tire) => tire.status !== 'ok') ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.inspectionTires}</p>
                <ul className="mt-1 space-y-1">
                  {review.inspection.sheet.tires.filter((tire) => tire.status !== 'ok').map((tire) => (
                    <li key={tire.position} className="flex justify-between gap-2">
                      <span className="font-medium">{tire.position}</span>
                      <span className={cn('tabular-nums', tire.status === 'fix' ? 'text-destructive-text' : 'text-warning-foreground dark:text-warning')}>{tire.psi} PSI · {tire.tread}/32</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {review.inspection.sheet.notes ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.inspectionNotes}</p>
                <p className="mt-1">{review.inspection.sheet.notes}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </SectionCard>

      {/* D46 / SQ-3: what Safety already found on this visit. */}
      {review.findings?.length ? (
        <SectionCard title={t.previousFindings} count={review.findings.length}>
          <ul className="divide-y text-sm" data-testid="qc-previous-findings">
            {review.findings.map((finding) => (
              <li key={finding.id} className="px-4 py-2.5">
                “{finding.text}”
                {finding.job ? <span className="text-muted-foreground"> → {finding.job}</span> : null}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {review.blockers.length ? (
        <SectionCard title={t.blockersSection} count={review.blockers.length}>
          <ul className="divide-y text-sm">
            {review.blockers.map((blocker) => (
              <li key={`${blocker.startedAt}-${blocker.job}`} className="px-4 py-3">
                <p>
                  {blocker.job ? <b className="font-medium">{blocker.job}</b> : null}
                  {' · '}{messages.pauseReason[blocker.reason as keyof typeof messages.pauseReason] ?? blocker.reason}
                  {blocker.reportedBy ? ` · ${blocker.reportedBy}` : ''}
                </p>
                {blocker.note ? <p className="italic">“{blocker.note}”</p> : null}
                <p className="text-xs text-muted-foreground">{t.resolvedBy(blocker.resolvedBy ?? '—', when(blocker.resolvedAt))}{blocker.resolution ? ` · “${blocker.resolution}”` : ''}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {review.previousReturns.length ? (
        <SectionCard title={t.returnedBefore} count={review.previousReturns.length}>
          <ul className="divide-y text-sm" data-testid="qc-previous-returns">
            {review.previousReturns.map((entry) => (
              <li key={entry.returnedAt} className="px-4 py-3">
                {entry.note ? <p className="italic">“{entry.note}”</p> : null}
                <p className="text-xs text-muted-foreground">{t.returnedByOn(entry.returnedBy ?? '—', when(entry.returnedAt))}</p>
                <p className="text-xs text-muted-foreground">{t.resolvedBy(entry.resolvedBy ?? '—', when(entry.resolvedAt))}{entry.resolution ? ` · “${entry.resolution}”` : ''}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </>
  );
}

function ReturnedTab({ items }: { items: QualityCheckReturnedItem[] }) {
  const { messages } = useShopLocale();
  const t = messages.qc;
  if (!items.length) return <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{t.noneReturned}</div>;
  return (
    <ul className="space-y-2" data-testid="qc-returned">
      {items.map((item) => (
        <li key={item.workOrderId} className="space-y-1 rounded-xl border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold">{messages.truckTitle(item.truck.truckNumber)}</span>
            <Badge variant="warning">{t.waitingForManager}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {[formatVehicleYmm(item.truck), item.displayId, relativeTime(item.returnedAt, messages.locale)].filter(Boolean).join(' · ')}
          </p>
          {item.note ? <p className="italic">“{item.note}”</p> : null}
          {item.returnedBy ? <p className="text-xs text-muted-foreground">{item.returnedBy}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function DoneTab({ enabled, onBack }: { enabled: boolean; onBack: () => void }) {
  const { messages } = useShopLocale();
  const t = messages.qc;
  const { data, error, mutate } = useQualityCheckHistory(enabled);
  const dayOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso));
  const today = dayOf(new Date().toISOString());
  const items = data?.items ?? [];
  const groups = [
    { label: t.doneToday, items: items.filter((item) => dayOf(item.at) === today) },
    { label: t.doneEarlier, items: items.filter((item) => dayOf(item.at) !== today) },
  ].filter((group) => group.items.length);
  return (
    <section data-testid="qc-done">
      <PageHeader className="mb-4" title={t.doneTitle} subtitle={t.doneHint} />
      {error ? (
        <div className="space-y-2" role="alert">
          <InlineAlert>{apiErrorMessage(error, messages, t.loadError)}</InlineAlert>
          <Button variant="outline" onClick={() => void mutate()}><RotateCw aria-hidden="true" />{messages.retry}</Button>
        </div>
      ) : null}
      {!data && !error ? <CardListSkeleton count={2} /> : null}
      {data && !items.length ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          <p>{t.noneDone}</p>
          <Button variant="ghost" className="mt-1" onClick={onBack}><ClipboardCheck aria-hidden="true" />{t.tabReview}</Button>
        </div>
      ) : null}
      {groups.map((group) => (
        <div key={group.label}>
          <p className="flex items-center gap-2 pb-1 pt-3 text-xs font-medium text-muted-foreground">{group.label}<CountChip>{group.items.length}</CountChip></p>
          <ul className="divide-y rounded-xl border bg-card">
            {group.items.map((item) => (
              <li key={`${item.workOrderId}-${item.at}`} className="flex items-start gap-3 px-3 py-3 text-sm">
                {item.outcome === 'approved'
                  ? <CheckCheck aria-hidden="true" className="mt-0.5 size-4 text-success" />
                  : <Undo2 aria-hidden="true" className="mt-0.5 size-4 text-warning-foreground dark:text-warning" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {messages.truckTitle(item.truck.truckNumber)} <span className="font-mono text-xs text-muted-foreground">{item.displayId}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.outcome === 'approved' ? t.approvedLabel : t.returnedLabel} · {formatShopDateTime(item.at, messages.locale)}
                  </p>
                  {item.note ? <p className="mt-0.5 truncate italic text-muted-foreground">“{item.note}”</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
