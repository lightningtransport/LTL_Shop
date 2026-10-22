'use client';

import { useState, type ReactNode } from 'react';
import { Tabs } from 'radix-ui';
import {
  ArrowLeftRight,
  CheckCheck,
  CircleCheck,
  CirclePause,
  CircleSlash,
  FilePlus,
  History,
  MessageSquare,
  Moon,
  Play,
  Plus,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { AdminWorkOrderDetailDto, PauseEventDto } from '@ltl-shop/shared';
import { formatDuration } from '@/lib/admin-format';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { adminActivityEventLabel } from '@/lib/status-chips';
import { correctedSegmentIds, formatDay, formatShortDateTime, formatTime } from '@/lib/work-order-view';
import { cn } from '@/lib/utils';
import { Button, DialogActions, Input, Modal, Textarea } from './ui';

export type HistoryTab = 'activity' | 'times' | 'pauses';

export type TimeSegment = {
  id: string;
  targetType: 'work_session' | 'pause_event';
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  mechanic: { id: string; name: string } | null;
  endReason: string | null;
};

const ACTIVITY_PREVIEW = 7;
const TAB = 'inline-flex h-12 items-center gap-1 whitespace-nowrap font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_var(--primary)]';

type Tone = 'success' | 'primary' | 'warning' | 'muted';
const TONE_VAR: Record<Tone, string> = { success: 'var(--success)', primary: 'var(--primary)', warning: 'var(--warning)', muted: 'var(--muted-foreground)' };

/** Stage 8 (mockup): each Activity Log event as a sentence with an icon and a tone. `{job}` events need the Job's name. */
const ACTIVITY: Record<string, { key: keyof AdminMessages; icon: LucideIcon; tone: Tone; job?: boolean }> = {
  work_order_created: { key: 'activityCreated', icon: FilePlus, tone: 'muted' },
  work_started: { key: 'activityStarted', icon: Play, tone: 'primary' },
  job_added: { key: 'activityAddedJob', icon: Plus, tone: 'muted', job: true },
  job_completed: { key: 'activityCompletedJob', icon: CircleCheck, tone: 'success', job: true },
  job_cancelled: { key: 'activityCancelledJob', icon: CircleSlash, tone: 'muted', job: true },
  work_paused: { key: 'activityPaused', icon: CirclePause, tone: 'warning' },
  work_resumed: { key: 'activityResumed', icon: Play, tone: 'primary' },
  blocker_reported: { key: 'activityBlocker', icon: TriangleAlert, tone: 'warning', job: true },
  blocker_resolved: { key: 'activityResolved', icon: CircleCheck, tone: 'success', job: true },
  note_added: { key: 'activityNote', icon: MessageSquare, tone: 'muted' },
  work_order_completed: { key: 'activityWoCompleted', icon: CheckCheck, tone: 'success' },
};

/**
 * Stage 5 (R4, R7) / Stage 8 (mockup): the always-open History card — tabs in its header. Activity is a
 * timeline by day (icon and tone per event, a sentence with the names in bold, 7 then "Show all"); Times has
 * the six totals and **one** box of labor and pause segments (newest first, the end reason and "Corrected" as
 * chips; each closed one has "Correct…", which opens a dialog); Pauses lists the official pauses.
 */
export function WorkOrderHistory({
  data,
  locale,
  messages,
  tab,
  onTabChange,
  canCorrect,
  pending,
  onCorrect,
}: {
  data: AdminWorkOrderDetailDto;
  locale: AdminLocale;
  messages: AdminMessages;
  tab: HistoryTab;
  onTabChange: (tab: HistoryTab) => void;
  canCorrect: boolean;
  pending: boolean;
  /** Resolves true when the correction was saved (the dialog closes). */
  onCorrect: (segment: TimeSegment, input: { startedAt: string; endedAt: string; reason: string }) => Promise<boolean>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [correcting, setCorrecting] = useState<TimeSegment | null>(null);
  const segments = [...timeSegments(data)].reverse();
  const corrected = correctedSegmentIds(data);
  const activity = [...data.activityLog].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const shown = showAll ? activity : activity.slice(0, ACTIVITY_PREVIEW);
  const days = groupByDay(shown, locale);
  const pauses = officialPauses(data);

  return (
    <Tabs.Root value={tab} onValueChange={(value) => onTabChange(value as HistoryTab)} asChild>
      <section id="history" className="scroll-mt-20 rounded-xl border bg-card text-card-foreground" aria-labelledby="admin-wo-history-title" data-testid="admin-wo-history">
        <div className="flex flex-wrap items-center justify-between gap-x-2 border-b px-4">
          <h2 id="admin-wo-history-title" className="py-3 text-base font-semibold">{messages.historyHeading}</h2>
          <Tabs.List aria-label={messages.historyAndAudit} className="-mx-4 flex w-[calc(100%+2rem)] gap-5 overflow-x-auto border-t px-4 sm:mx-0 sm:w-auto sm:border-t-0 sm:px-0">
            <Tabs.Trigger value="activity" className={TAB}>{messages.woTabActivity} <span className="tnum text-xs">{activity.length}</span></Tabs.Trigger>
            <Tabs.Trigger value="times" className={TAB}>{messages.woTabTimes}</Tabs.Trigger>
            <Tabs.Trigger value="pauses" className={TAB}>{messages.woTabPauses} <span className="tnum text-xs">{pauses.length}</span></Tabs.Trigger>
          </Tabs.List>
        </div>

        <Tabs.Content value="activity" className="p-4" aria-label={messages.activityLog}>
          {activity.length ? (
            <>
              {days.map(([day, entries], index) => (
                <div key={day}>
                  <p className={cn('mb-3 text-xs font-medium text-muted-foreground', index > 0 && 'mt-6')}>{day}</p>
                  <ol className="relative ml-3 space-y-4 border-l pl-6">
                    {entries.map((entry) => <ActivityItem key={entry.id} entry={entry} locale={locale} messages={messages} />)}
                  </ol>
                </div>
              ))}
              {activity.length > ACTIVITY_PREVIEW ? (
                <Button type="button" variant="outline" className="mt-5 w-full text-muted-foreground" onClick={() => setShowAll(!showAll)}>
                  {showAll ? messages.showLess : fillPlaceholders(messages.activityShowAllEvents, { count: String(activity.length) })}
                </Button>
              ) : null}
            </>
          ) : <Empty icon={History}>{messages.noActivity}</Empty>}
        </Tabs.Content>

        <Tabs.Content value="times" className="p-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label={messages.created} value={formatShortDateTime(data.createdAt, locale)} />
            <Fact label={messages.started} value={formatShortDateTime(data.startedAt, locale)} />
            <Fact label={messages.completed} value={formatShortDateTime(data.completedAt, locale)} />
            <Fact label={messages.updated} value={formatShortDateTime(data.updatedAt, locale)} />
            <Fact label={messages.activeLabor} value={formatDuration(data.totalActiveLaborMs)} />
            <Fact label={messages.metricsWaiting} value={formatDuration(data.totalWaitingMs)} />
          </dl>
          <div className="mt-5 overflow-hidden rounded-lg border" data-testid="labor-segments">
            <div className="space-y-0.5 bg-sunken px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium">{messages.laborSessions}</p>
              <p>
                {messages.laborSegmentsLegend}{' '}
                <b className="font-medium">{messages.laborEndDayClose}</b>: {messages.dayCloseLegend}{' '}
                <b className="font-medium">{messages.laborEndSwitchedTruck}</b>: {messages.switchedTruckLegend}
              </p>
            </div>
            {segments.length ? (
              <ul className="divide-y">
                {segments.map((segment) => {
                  const end = laborEnd(segment.endReason, messages);
                  const who = segment.targetType === 'pause_event'
                    ? messages.segmentWaiting
                    : fillPlaceholders(messages.segmentLabor, { name: segment.mechanic?.name ?? messages.laborUnattributed });
                  return (
                    <li key={`${segment.targetType}:${segment.id}`} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between" data-testid="time-segment">
                      <span>
                        <span className="font-medium">{who}</span>
                        <br className="sm:hidden" />
                        <span className={cn('tnum', segment.endedAt ? 'text-muted-foreground' : 'text-success')}> {segmentRange(segment, locale, messages)}</span>
                        {end ? (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-xs text-muted-foreground" data-testid="labor-end-reason">
                            <end.icon aria-hidden="true" className="size-3.5" />{end.label}
                          </span>
                        ) : null}
                        {corrected.has(segment.id) ? <span className="ml-2 rounded-md border px-1.5 py-px text-xs text-muted-foreground">{messages.correctedChip}</span> : null}
                      </span>
                      {canCorrect && segment.endedAt ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-10 self-start text-primary sm:h-8 sm:self-auto"
                          disabled={pending}
                          aria-label={fillPlaceholders(messages.correctTimeFor, { segment: `${who} · ${formatShortDateTime(segment.startedAt, locale)}` })}
                          onClick={() => setCorrecting(segment)}
                        >
                          {messages.correctTimeAction}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="px-3 py-4 text-center text-muted-foreground">{messages.timeCorrectionEmpty}</p>}
          </div>
        </Tabs.Content>

        <Tabs.Content value="pauses" className="p-4">
          {pauses.length ? (
            <ul className="divide-y">
              {pauses.map((pause) => (
                <li key={pause.id} className="py-3 first:pt-0">
                  <p className="font-medium">{adminPauseReasonLabel(pause.reason, messages)}</p>
                  <p className="tnum text-muted-foreground">
                    {formatShortDateTime(pause.startedAt, locale)} → {pause.endedAt ? formatShortDateTime(pause.endedAt, locale) : messages.pauseNow}
                    {pause.durationMs !== null ? ` · ${formatDuration(pause.durationMs)}` : ''}
                  </p>
                  {pause.notes ? <p className="mt-0.5">{pause.notes}</p> : null}
                  {pause.by ? <p className="mt-0.5 text-xs text-muted-foreground">{pause.by}</p> : null}
                </li>
              ))}
            </ul>
          ) : <Empty icon={CirclePause}>{messages.noPausesOnWo}</Empty>}
        </Tabs.Content>

        {correcting ? (
          <CorrectTimeDialog
            segment={correcting}
            locale={locale}
            messages={messages}
            pending={pending}
            onClose={() => setCorrecting(null)}
            onConfirm={async (input) => { if (await onCorrect(correcting, input)) setCorrecting(null); }}
          />
        ) : null}
      </section>
    </Tabs.Root>
  );
}

type Activity = AdminWorkOrderDetailDto['activityLog'][number];

function ActivityItem({ entry, locale, messages }: { entry: Activity; locale: AdminLocale; messages: AdminMessages }) {
  const kind = ACTIVITY[entry.eventType];
  const job = valueString(entry.newValue, 'displayName') ?? valueString(entry.relevantValue, 'displayName') ?? valueString(entry.relevantValue, 'jobName');
  const useKind = kind && (!kind.job || job);
  const Icon = useKind ? kind.icon : History;
  const tone = useKind ? kind.tone : 'muted';
  // LTR-218 (UX-1-005): Safety taking the Quality Check is logged as "mechanic added"; it reads as what Safety did.
  const qcTaken = valueString(entry.relevantValue, 'action') === 'quality_check_taken';
  const template = qcTaken ? messages.activityQcTaken : useKind ? String(messages[kind.key]) : messages.activityGeneric;
  const notes = valueString(entry.newValue, 'notes');
  // D55 R2: a Work Order closed without its inspection says so, with the Manager's reason.
  const skipped = (entry.newValue as { inspectionSkipped?: unknown } | null)?.inspectionSkipped === true;
  const detail = (skipped && notes ? fillPlaceholders(messages.activityClosedWithoutInspection, { reason: notes }) : notes)
    ?? valueString(entry.previousValue, 'notes') ?? (!useKind ? job : null);
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className="absolute -left-[37px] grid size-6 place-items-center rounded-full ring-4 ring-card"
        style={{ backgroundColor: 'var(--card)', backgroundImage: `linear-gradient(color-mix(in oklch, ${TONE_VAR[tone]} 18%, transparent), color-mix(in oklch, ${TONE_VAR[tone]} 18%, transparent))`, color: tone === 'warning' ? 'var(--warning-foreground)' : TONE_VAR[tone] }}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-3">
        <p>{boldFill(template, { user: entry.user.name, job: job ?? '', event: adminActivityEventLabel(entry.eventType, messages) })}</p>
        <time className="tnum shrink-0 text-xs text-muted-foreground" dateTime={entry.createdAt}>{formatTime(entry.createdAt, locale)}</time>
      </div>
      {detail ? <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{detail}</p> : null}
    </li>
  );
}

/** "{user} completed {job}" → the names in bold, the rest plain. */
function boldFill(template: string, values: Record<string, string>): ReactNode[] {
  return template.split(/(\{[a-z]+\})/g).filter(Boolean).map((part, index) => {
    const key = /^\{([a-z]+)\}$/.exec(part)?.[1];
    if (!key) return part;
    return key === 'event' ? <span key={index}>{values[key]}</span> : <b key={index} className="font-medium">{values[key]}</b>;
  });
}

function valueString(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' && field.trim() ? field : null;
}

function CorrectTimeDialog({
  segment,
  locale,
  messages,
  pending,
  onClose,
  onConfirm,
}: {
  segment: TimeSegment;
  locale: AdminLocale;
  messages: AdminMessages;
  pending: boolean;
  onClose: () => void;
  onConfirm: (input: { startedAt: string; endedAt: string; reason: string }) => void;
}) {
  const [startedAt, setStartedAt] = useState(toDatetimeLocal(segment.startedAt));
  const [endedAt, setEndedAt] = useState(segment.endedAt ? toDatetimeLocal(segment.endedAt) : '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const who = segment.targetType === 'pause_event'
    ? messages.segmentWaiting
    : fillPlaceholders(messages.segmentLabor, { name: segment.mechanic?.name ?? messages.laborUnattributed });
  const endNote = segment.endReason === 'day_close' ? messages.correctTimeDayClose : segment.endReason === 'switched_truck' ? messages.correctTimeSwitched : '';

  function submit() {
    if (!startedAt || !endedAt) {
      setError(messages.timeBothRequired);
      return;
    }
    if (new Date(endedAt) <= new Date(startedAt)) {
      setError(messages.timeEndAfterStart);
      return;
    }
    if (!reason.trim()) {
      setError(messages.timeReasonRequired);
      return;
    }
    setError(null);
    onConfirm({ startedAt: new Date(startedAt).toISOString(), endedAt: new Date(endedAt).toISOString(), reason: reason.trim() });
  }

  return (
    <Modal
      open
      title={messages.timeCorrectionTitle}
      description={`${who} · ${formatShortDateTime(segment.startedAt, locale)}.${endNote}`}
      closeLabel={messages.closeDialog}
      onClose={() => { if (!pending) onClose(); }}
    >
      <form className="space-y-3" data-testid="time-correction-dialog" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block min-w-0 space-y-1">
            <span className="text-sm font-medium">{messages.timeCorrectionStartedAt}</span>
            <Input type="datetime-local" aria-label={messages.timeCorrectionStartedAt} value={startedAt} onChange={(event) => { setStartedAt(event.target.value); setError(null); }} />
          </label>
          <label className="block min-w-0 space-y-1">
            <span className="text-sm font-medium">{messages.timeCorrectionEndedAt}</span>
            <Input type="datetime-local" aria-label={messages.timeCorrectionEndedAt} value={endedAt} onChange={(event) => { setEndedAt(event.target.value); setError(null); }} />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{messages.timeCorrectionReason}</span>
          <Textarea aria-label={messages.timeCorrectionReason} rows={2} value={reason} onChange={(event) => { setReason(event.target.value); setError(null); }} maxLength={1000} />
          <span className="text-xs text-muted-foreground">{messages.timeCorrectionReasonHelp}</span>
        </label>
        {error ? <p className="text-sm font-medium text-destructive-text" role="alert">{error}</p> : null}
        <DialogActions>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{messages.dialogBack}</Button>
          <Button loading={pending} type="submit">{messages.timeCorrectionConfirm}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}

/** Labor sessions and official pauses in one list (oldest first); open ones cannot be corrected. */
export function timeSegments(data: AdminWorkOrderDetailDto): TimeSegment[] {
  const sessions = (data.laborSessions ?? []).map((session) => ({
    id: session.id,
    targetType: 'work_session' as const,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: session.durationMs,
    mechanic: session.mechanic ?? null,
    endReason: session.endReason ?? null,
  }));
  const pauses = data.pauseHistory
    .filter((pause) => pause.isOfficialPause !== false)
    .map((pause) => ({
      id: pause.id,
      targetType: 'pause_event' as const,
      startedAt: pause.startedAt,
      endedAt: pause.endedAt,
      durationMs: pause.durationMs,
      mechanic: null,
      endReason: null,
    }));
  return [...sessions, ...pauses].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
}

/** LTR-186: why the app closed a labor segment — the day close (D20) or a Truck switch (D21). */
function laborEnd(endReason: string | null | undefined, messages: AdminMessages): { label: string; icon: LucideIcon } | null {
  if (endReason === 'day_close') return { label: messages.laborEndDayClose, icon: Moon };
  if (endReason === 'switched_truck') return { label: messages.laborEndSwitchedTruck, icon: ArrowLeftRight };
  return null;
}

function segmentRange(segment: TimeSegment, locale: AdminLocale, messages: AdminMessages) {
  const start = formatShortDateTime(segment.startedAt, locale);
  if (!segment.endedAt) return `${start} → ${messages.laborSessionRunning}`;
  return `${start} → ${formatTime(segment.endedAt, locale)}${segment.durationMs !== null ? ` · ${formatDuration(segment.durationMs)}` : ''}`;
}

/** The official pauses (the current one included), newest first. */
function officialPauses(data: AdminWorkOrderDetailDto) {
  type Row = PauseEventDto & { by: string | null };
  const list: Row[] = data.pauseHistory
    .filter((pause) => pause.isOfficialPause !== false)
    .map((pause) => ({ ...pause, by: pause.createdBy?.name ?? null }));
  const current = data.currentPause;
  if (current && !list.some((pause) => pause.id === current.id)) list.push({ ...current, by: null });
  return list.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function groupByDay<T extends { createdAt: string }>(entries: T[], locale: AdminLocale): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const day = formatDay(entry.createdAt, locale);
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }
  return [...groups.entries()];
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className={cn('tnum mt-1 font-medium', value === '—' && 'text-muted-foreground')}>{value}</dd></div>;
}

function Empty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 py-6 text-center text-muted-foreground">
      <Icon aria-hidden="true" className="size-5" />
      <p>{children}</p>
    </div>
  );
}
