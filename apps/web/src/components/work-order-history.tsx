'use client';

import { useState } from 'react';
import { Tabs } from 'radix-ui';
import type { AdminWorkOrderDetailDto } from '@ltl-shop/shared';
import { formatAdminDate, formatDuration } from '@/lib/admin-format';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { intlLocale } from '@/lib/shop-locale';
import { adminActivityEventDetail, adminActivityEventLabel } from '@/lib/status-chips';
import { Button, CompactEmpty, Input, Modal, Textarea } from './ui';

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

const ACTIVITY_PREVIEW = 10;
const TAB = 'inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground';

/**
 * Stage 5 (R4, R7): "History and audit" as tabs — Activity (by day, the latest first, "Show all"),
 * Times (the totals and **one** list of labor and pause segments; each closed one has "Correct…",
 * which opens a dialog) and Pauses. Before, the segments were listed twice (a list and the select of
 * a time-correction form that was always open).
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
  const segments = timeSegments(data);
  const activity = [...data.activityLog].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const shown = showAll ? activity : activity.slice(0, ACTIVITY_PREVIEW);
  const days = groupByDay(shown, locale);

  return (
    <Tabs.Root value={tab} onValueChange={(value) => onTabChange(value as HistoryTab)} className="p-4">
      <Tabs.List aria-label={messages.historyAndAudit} className="-mx-1 flex gap-1 overflow-x-auto border-b">
        <Tabs.Trigger value="activity" className={TAB}>{messages.woTabActivity}</Tabs.Trigger>
        <Tabs.Trigger value="times" className={TAB}>{messages.woTabTimes}</Tabs.Trigger>
        <Tabs.Trigger value="pauses" className={TAB}>{messages.woTabPauses}</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="activity" className="pt-4">
        {activity.length ? (
          <div className="space-y-4" aria-label={messages.activityLog}>
            {days.map(([day, entries]) => (
              <section key={day} className="space-y-1">
                <h3 className="group-title">{day}</h3>
                <ol className="divide-y">
                  {entries.map((entry) => {
                    const detail = adminActivityEventDetail(entry);
                    return (
                      <li key={entry.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 py-2 text-sm">
                        <time className="text-xs tabular-nums text-muted-foreground" dateTime={entry.createdAt}>{formatTime(entry.createdAt, locale)}</time>
                        <div className="min-w-0">
                          <p><span className="font-medium">{adminActivityEventLabel(entry.eventType, messages)}</span> <span className="text-muted-foreground">· {entry.user.name}</span></p>
                          {detail ? <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{detail}</p> : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
            {activity.length > ACTIVITY_PREVIEW && !showAll ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAll(true)}>
                {fillPlaceholders(messages.activityShowAll, { count: String(activity.length) })}
              </Button>
            ) : null}
          </div>
        ) : <CompactEmpty>{messages.noActivity}</CompactEmpty>}
      </Tabs.Content>

      <Tabs.Content value="times" className="space-y-4 pt-4">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Fact label={messages.created} value={formatAdminDate(data.createdAt, locale)} />
          <Fact label={messages.started} value={formatAdminDate(data.startedAt, locale)} />
          <Fact label={messages.completed} value={formatAdminDate(data.completedAt, locale)} />
          <Fact label={messages.activeLabor} value={formatDuration(data.totalActiveLaborMs)} />
          <Fact label={messages.waitingTime} value={formatDuration(data.totalWaitingMs)} />
          <Fact label={messages.updated} value={formatAdminDate(data.updatedAt, locale)} />
        </dl>
        <div data-testid="labor-segments">
          <h3 className="group-title">{messages.laborSessions}</h3>
          {canCorrect ? <p className="mt-0.5 text-sm text-muted-foreground">{messages.timeCorrectionDescription}</p> : null}
          {segments.length ? (
            <ul className="mt-2 divide-y text-sm">
              {segments.map((segment) => {
                const label = laborEndLabel(segment.endReason, messages);
                const who = segment.targetType === 'pause_event' ? messages.officialPauseSegment : segment.mechanic?.name ?? messages.laborUnattributed;
                return (
                  <li key={`${segment.targetType}:${segment.id}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2" data-testid="time-segment">
                    <div className="min-w-0">
                      <p className="font-medium">{who}</p>
                      <p className="text-muted-foreground">
                        {formatAdminDate(segment.startedAt, locale)} → {segment.endedAt ? formatAdminDate(segment.endedAt, locale) : <span className="text-shop-success">{messages.laborSessionRunning}</span>}
                        {segment.durationMs !== null ? ` · ${formatDuration(segment.durationMs)}` : ''}
                        {label ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs" data-testid="labor-end-reason">{label}</span> : null}
                      </p>
                    </div>
                    {canCorrect && segment.endedAt ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        aria-label={fillPlaceholders(messages.correctTimeFor, { segment: `${who} · ${formatAdminDate(segment.startedAt, locale)}` })}
                        onClick={() => setCorrecting(segment)}
                      >
                        {messages.correctTimeAction}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : <CompactEmpty>{messages.timeCorrectionEmpty}</CompactEmpty>}
        </div>
      </Tabs.Content>

      <Tabs.Content value="pauses" className="space-y-4 pt-4">
        {data.currentPause ? (
          <section className="space-y-1">
            <h3 className="group-title">{messages.currentPause}</h3>
            <Pause pause={data.currentPause} locale={locale} messages={messages} />
          </section>
        ) : null}
        <section className="space-y-1">
          <h3 className="group-title">{messages.pauseHistory}</h3>
          {data.pauseHistory.length ? (
            <ul className="divide-y">
              {data.pauseHistory.map((pause) => (
                <li key={pause.id} className="py-3 first:pt-0">
                  <Pause pause={pause} locale={locale} messages={messages} />
                  <p className="mt-1 text-xs text-muted-foreground">{pause.createdBy.name}</p>
                </li>
              ))}
            </ul>
          ) : <CompactEmpty>{messages.noPauseHistory}</CompactEmpty>}
        </section>
      </Tabs.Content>

      {correcting ? (
        <CorrectTimeDialog
          segment={correcting}
          messages={messages}
          pending={pending}
          onClose={() => setCorrecting(null)}
          onConfirm={async (input) => { if (await onCorrect(correcting, input)) setCorrecting(null); }}
        />
      ) : null}
    </Tabs.Root>
  );
}

function CorrectTimeDialog({
  segment,
  messages,
  pending,
  onClose,
  onConfirm,
}: {
  segment: TimeSegment;
  messages: AdminMessages;
  pending: boolean;
  onClose: () => void;
  onConfirm: (input: { startedAt: string; endedAt: string; reason: string }) => void;
}) {
  const [startedAt, setStartedAt] = useState(toDatetimeLocal(segment.startedAt));
  const [endedAt, setEndedAt] = useState(segment.endedAt ? toDatetimeLocal(segment.endedAt) : '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!startedAt || !endedAt || new Date(endedAt) <= new Date(startedAt)) {
      setError(messages.timeCorrectionBadRequest);
      return;
    }
    if (!reason.trim()) {
      setError(messages.timeCorrectionReasonRequired);
      return;
    }
    setError(null);
    onConfirm({ startedAt: new Date(startedAt).toISOString(), endedAt: new Date(endedAt).toISOString(), reason: reason.trim() });
  }

  return (
    <Modal open title={messages.timeCorrectionTitle} closeLabel={messages.closeDialog} onClose={() => { if (!pending) onClose(); }}>
      <form className="space-y-3" data-testid="time-correction-dialog" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        {laborEndLabel(segment.endReason, messages) ? (
          <p className="text-sm text-muted-foreground">{laborEndLabel(segment.endReason, messages)}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">{messages.timeCorrectionStartedAt}</span>
            <Input type="datetime-local" aria-label={messages.timeCorrectionStartedAt} value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">{messages.timeCorrectionEndedAt}</span>
            <Input type="datetime-local" aria-label={messages.timeCorrectionEndedAt} value={endedAt} onChange={(event) => setEndedAt(event.target.value)} />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{messages.timeCorrectionReason}</span>
          <Textarea aria-label={messages.timeCorrectionReason} value={reason} onChange={(event) => { setReason(event.target.value); setError(null); }} maxLength={1000} />
          <span className="text-xs text-muted-foreground">{messages.timeCorrectionReasonHelp}</span>
        </label>
        {error ? <p className="text-sm font-medium text-destructive-text" role="alert">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" disabled={pending} onClick={onClose}>{messages.cancel}</Button>
          <Button type="submit" className="flex-1" disabled={pending}>{pending ? messages.saving : messages.timeCorrectionConfirm}</Button>
        </div>
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
function laborEndLabel(endReason: string | null | undefined, messages: AdminMessages) {
  if (endReason === 'day_close') return messages.laborEndDayClose;
  if (endReason === 'switched_truck') return messages.laborEndSwitchedTruck;
  return null;
}

function groupByDay<T extends { createdAt: string }>(entries: T[], locale: AdminLocale): Array<[string, T[]]> {
  const format = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const day = format.format(new Date(entry.createdAt));
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }
  return [...groups.entries()];
}

function formatTime(value: string, locale: AdminLocale) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>;
}

function Pause({ pause, locale, messages }: { pause: { reason: string; notes: string | null; startedAt: string; endedAt: string | null; durationMs: number | null }; locale: AdminLocale; messages: AdminMessages }) {
  return (
    <div>
      <p className="font-medium">{adminPauseReasonLabel(pause.reason, messages)}</p>
      <p className="text-sm text-muted-foreground">{formatAdminDate(pause.startedAt, locale)} → {formatAdminDate(pause.endedAt, locale)}{pause.durationMs !== null ? ` · ${formatDuration(pause.durationMs)}` : ''}</p>
      {pause.notes ? <p className="mt-1 text-sm">{pause.notes}</p> : null}
    </div>
  );
}
