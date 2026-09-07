'use client';

import Link from 'next/link';
import { AlertTriangle, ClipboardCheck, ClipboardList, Clock3, UserRoundX, Wrench } from 'lucide-react';
import { AppCapability } from '@ltl-shop/shared';
import { AdminWorkOrderItem } from './admin-work-order-item';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, LoadFailure, PageSkeleton } from './ui';
import { formatAdminDate } from '@/lib/admin-format';
import { useAdminDashboard } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { useAuth } from '@/lib/auth-context';

export function AdminDashboard({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const { user } = useAuth();
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
  const canStandard = !!user?.capabilities.includes(AppCapability.MECHANIC_STANDARD);
  const canPm = !!user?.capabilities.includes(AppCapability.MECHANIC_PM);

  return <div className="space-y-5">
    <header>
      <p className="section-label">{messages.eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-wide sm:text-4xl">{messages.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{messages.currentOperations}</p>
      <p className="mt-1 text-xs text-muted-foreground">{messages.generatedAt}: {formatAdminDate(data.generatedAt, locale)} · supabase_postgres</p>
    </header>
    {canStandard || canPm ? (
      <section aria-labelledby="admin-workspaces-title">
        <div className="mb-3">
          <h2 id="admin-workspaces-title" className="font-display text-xl font-semibold">{messages.workspaces}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{messages.workspacesBody}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {canStandard ? (
            <Card>
              <CardHeader><Wrench aria-hidden="true" className="size-5 text-primary" /><CardTitle>{messages.standardWorkspace}</CardTitle><CardDescription>{messages.standardWorkspaceBody}</CardDescription></CardHeader>
              <CardContent><Button asChild className="w-full"><Link href="/mechanic/standard">{messages.openStandardWorkspace}</Link></Button></CardContent>
            </Card>
          ) : null}
          {canPm ? (
            <Card>
              <CardHeader><ClipboardCheck aria-hidden="true" className="size-5 text-primary" /><CardTitle>{messages.pmWorkspace}</CardTitle><CardDescription>{messages.pmWorkspaceBody}</CardDescription></CardHeader>
              <CardContent><Button asChild className="w-full"><Link href="/mechanic/pm">{messages.openPmWorkspace}</Link></Button></CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    ) : null}
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-6" aria-label={messages.currentOperations}>
      {metrics.map(([label, value, Icon]) => <Card key={label} className="min-h-28 p-3 sm:p-4">
        <CardContent className="flex h-full items-start justify-between gap-2"><div className="flex h-full min-w-0 flex-col justify-between"><p className="text-xs leading-5 text-muted-foreground sm:text-sm">{label}</p><p className="mt-2 font-display text-2xl font-bold sm:text-3xl">{value}</p></div><Icon aria-hidden="true" className="size-4 shrink-0 text-primary sm:size-5" /></CardContent>
      </Card>)}
    </section>
    <Card className="overflow-hidden p-0">
      <CardHeader className="mb-0 border-b p-4 sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div><CardTitle>{messages.attention}</CardTitle><CardDescription>{messages.attentionBody}</CardDescription></div>
        <Button asChild variant="outline" size="sm"><Link href="/admin/work-orders">{messages.viewAll}</Link></Button>
      </CardHeader>
      <CardContent className="space-y-2 p-2 sm:p-3">
        {data.attention.length ? data.attention.map((item) => <AdminWorkOrderItem key={item.id} item={item} locale={locale} messages={messages} compact />) : <EmptyState>{messages.noAttention}</EmptyState>}
      </CardContent>
    </Card>
  </div>;
}
