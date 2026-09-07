'use client';

import Link from 'next/link';
import { AlertTriangle, ClipboardList, Clock3, UserRoundX } from 'lucide-react';
import { AdminWorkOrderItem } from './admin-work-order-item';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, LoadFailure, PageSkeleton } from './ui';
import { formatAdminDate } from '@/lib/admin-format';
import { useAdminDashboard } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

export function AdminDashboard({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const { data, error, isLoading, mutate } = useAdminDashboard();
  if (isLoading) return <PageSkeleton label={messages.currentOperations} />;
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  const metrics = [
    [messages.openWorkOrders, data.counts.open, ClipboardList],
    [messages.created, data.counts.created, ClipboardList],
    [messages.inProgress, data.counts.inProgress, Clock3],
    [messages.waitingPaused, data.counts.waitingPaused, Clock3],
    [messages.highCritical, data.counts.highCriticalOpen, AlertTriangle],
    [messages.unassigned, data.counts.unassignedOpen, UserRoundX],
  ] as const;

  return <div className="space-y-6">
    <header>
      <p className="section-label">{messages.eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-wide sm:text-4xl">{messages.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{messages.currentOperations}</p>
      <p className="mt-1 text-xs text-muted-foreground">{messages.generatedAt}: {formatAdminDate(data.generatedAt, locale)} · supabase_postgres</p>
    </header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={messages.currentOperations}>
      {metrics.map(([label, value, Icon]) => <Card key={label}>
        <CardContent className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl font-bold">{value}</p></div><Icon aria-hidden="true" className="size-5 text-primary" /></CardContent>
      </Card>)}
    </section>
    <Card>
      <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div><CardTitle>{messages.attention}</CardTitle><CardDescription>{messages.attentionBody}</CardDescription></div>
        <Button asChild variant="outline" size="sm"><Link href="/admin/work-orders">{messages.viewAll}</Link></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.attention.length ? data.attention.map((item) => <AdminWorkOrderItem key={item.id} item={item} locale={locale} messages={messages} compact />) : <EmptyState>{messages.noAttention}</EmptyState>}
      </CardContent>
    </Card>
  </div>;
}
