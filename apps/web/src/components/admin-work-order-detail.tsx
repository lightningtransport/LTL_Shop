'use client';

import Link from 'next/link';
import { ApiError } from '@/lib/api';
import { formatAdminDate, formatDuration, humanize } from '@/lib/admin-format';
import { useAdminWorkOrder } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, LoadFailure, PageSkeleton, PriorityBadge } from './ui';

export function AdminWorkOrderDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const { data, error, isLoading, mutate } = useAdminWorkOrder(id);
  if (isLoading) return <PageSkeleton label={messages.workOrdersTitle} />;
  if (error instanceof ApiError && error.status === 404) return <NotFound messages={messages} />;
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  return <div className="space-y-6">
    <header>
      <Button asChild variant="ghost" size="sm" className="mb-3"><Link href="/admin/work-orders">← {messages.backToWorkOrders}</Link></Button>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="section-label">{messages.readOnly}</p><h1 className="mt-2 font-display text-3xl font-bold">{data.displayId}</h1><p className="mt-2 text-muted-foreground">{data.truck.truckNumber} · {data.category.name}</p></div><div className="flex gap-2"><PriorityBadge priority={data.priority} /><Badge variant="outline">{humanize(data.status)}</Badge></div></div>
    </header>
    <section className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>{messages.jobs} ({data.jobsCompleted}/{data.jobsTotal})</CardTitle></CardHeader><CardContent>{data.jobs.length ? <ul className="divide-y">{data.jobs.map((job) => <li key={job.id} className="flex items-start justify-between gap-3 py-3 first:pt-0"><div><p className="font-medium">{job.displayName}</p><p className="text-xs text-muted-foreground">{job.category.name}</p>{job.customDescription ? <p className="mt-1 text-sm text-muted-foreground">{job.customDescription}</p> : null}</div><Badge variant={job.status === 'completed' ? 'success' : 'outline'}>{humanize(job.status)}</Badge></li>)}</ul> : <EmptyState>{messages.noJobs}</EmptyState>}</CardContent></Card>
      <div className="space-y-4">
        <Card><CardHeader><CardTitle>{messages.activeMechanics}</CardTitle></CardHeader><CardContent>{data.mechanics.length ? <ul className="space-y-2">{data.mechanics.map((mechanic) => <li key={mechanic.mechanicId} className="rounded-lg border p-3 font-medium">{mechanic.mechanicName}</li>)}</ul> : <EmptyState>{messages.noMechanics}</EmptyState>}</CardContent></Card>
        <Card><CardHeader><CardTitle>{messages.notes}</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.notes || messages.noNotes}</p></CardContent></Card>
      </div>
    </section>
    <Card><CardHeader><CardTitle>{messages.workOrderTimes}</CardTitle></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Info label={messages.created} value={formatAdminDate(data.createdAt, locale)} /><Info label={messages.started} value={formatAdminDate(data.startedAt, locale)} /><Info label={messages.completed} value={formatAdminDate(data.completedAt, locale)} /><Info label={messages.updated} value={formatAdminDate(data.updatedAt, locale)} /><Info label={messages.activeLabor} value={formatDuration(data.totalActiveLaborMs)} /><Info label={messages.waitingTime} value={formatDuration(data.totalWaitingMs)} /></dl></CardContent></Card>
    <section className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>{messages.currentPause}</CardTitle></CardHeader><CardContent>{data.currentPause ? <Pause pause={data.currentPause} locale={locale} /> : <EmptyState>{messages.noCurrentPause}</EmptyState>}</CardContent></Card>
      <Card><CardHeader><CardTitle>{messages.pauseHistory}</CardTitle></CardHeader><CardContent>{data.pauseHistory.length ? <ul className="divide-y">{data.pauseHistory.map((pause) => <li key={pause.id} className="py-3 first:pt-0"><Pause pause={pause} locale={locale} /><p className="mt-1 text-xs text-muted-foreground">{pause.createdBy.name}</p></li>)}</ul> : <EmptyState>{messages.noPauseHistory}</EmptyState>}</CardContent></Card>
    </section>
    <Card><CardHeader><CardTitle>{messages.activityLog}</CardTitle></CardHeader><CardContent>{data.activityLog.length ? <ol className="divide-y">{data.activityLog.map((entry) => <li key={entry.id} className="py-3 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{humanize(entry.eventType)}</p><time className="text-xs text-muted-foreground">{formatAdminDate(entry.createdAt, locale)}</time></div><p className="mt-1 text-sm text-muted-foreground">{entry.user.name} · {entry.entityType}</p>{entry.relevantValue !== null ? <pre className="mt-2 max-w-full overflow-x-auto rounded-lg bg-muted p-2 text-xs">{JSON.stringify(entry.relevantValue)}</pre> : null}</li>)}</ol> : <EmptyState>{messages.noActivity}</EmptyState>}</CardContent></Card>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }
function Pause({ pause, locale }: { pause: { reason: string; notes: string | null; startedAt: string; endedAt: string | null; durationMs: number | null }; locale: AdminLocale }) { return <div><p className="font-medium">{humanize(pause.reason)}</p><p className="text-sm text-muted-foreground">{formatAdminDate(pause.startedAt, locale)} → {formatAdminDate(pause.endedAt, locale)}{pause.durationMs !== null ? ` · ${formatDuration(pause.durationMs)}` : ''}</p>{pause.notes ? <p className="mt-1 text-sm">{pause.notes}</p> : null}</div>; }
function NotFound({ messages }: { messages: AdminMessages }) { return <EmptyState><p>{messages.workOrderNotFound}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/work-orders">{messages.backToWorkOrders}</Link></Button></EmptyState>; }
