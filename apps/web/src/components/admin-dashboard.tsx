'use client';

import Link from 'next/link';
import { AlertTriangle, CalendarCheck, ClipboardCheck, ClipboardList, Clock3, History, Wrench } from 'lucide-react';
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

  const windows = data.windows;
  const openStatuses = 'created,in_progress,waiting_paused';
  const query = (entries: Record<string, string>) => {
    const params = new URLSearchParams(entries);
    return `/admin/work-orders?${params.toString()}`;
  };
  const metrics = [
    { label: messages.openWorkOrders, description: messages.metricOpenDescription, value: data.counts.open, Icon: ClipboardList, href: query({ status: openStatuses }) },
    { label: messages.waitingPaused, description: messages.metricWaitingDescription, value: data.counts.waitingPaused, Icon: Clock3, href: query({ status: 'waiting_paused' }) },
    { label: messages.highCritical, description: messages.metricHighCriticalDescription, value: data.counts.highCriticalOpen, Icon: AlertTriangle, href: query({ status: openStatuses, priority: 'high,critical' }) },
    { label: messages.openOlderThan24h, description: messages.metricOlderDescription, value: data.counts.openOlderThan24h, Icon: History, href: query({ status: openStatuses, createdBefore: windows.openOlderThan24h.before }) },
    { label: messages.completedToday, description: messages.metricCompletedTodayDescription, value: data.counts.completedToday, Icon: CalendarCheck, href: query({ status: 'completed', completedFrom: windows.today.from, completedBefore: windows.today.to }) },
    { label: messages.completedLast7Days, description: messages.metricCompletedLast7DaysDescription, value: data.counts.completedLast7Days, Icon: CalendarCheck, href: query({ status: 'completed', completedFrom: windows.last7Days.from, completedBefore: windows.last7Days.to }) },
  ] as const;
  const canStandard = !!user?.capabilities.includes(AppCapability.MECHANIC_STANDARD);
  const canPm = !!user?.capabilities.includes(AppCapability.MECHANIC_PM);

  return <div className="space-y-5">
    <header>
      <p className="section-label">{messages.eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-wide sm:text-4xl">{messages.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{messages.currentOperations}</p>
      <p className="mt-1 text-xs text-muted-foreground">{messages.generatedAtLabel} {formatAdminDate(data.generatedAt, locale)}</p>
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
      {metrics.map(({ label, description, value, Icon, href }) => <Link key={label} href={href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <Card className="flex h-full min-h-28 flex-col justify-between p-3 transition group-hover:border-primary/50 group-hover:shadow-md sm:p-4">
          <CardContent className="flex items-start justify-between gap-2 p-0"><div className="min-w-0"><p className="text-xs leading-5 text-muted-foreground sm:text-sm">{label}</p><p className="mt-2 font-display text-2xl font-bold sm:text-3xl">{value}</p></div><Icon aria-hidden="true" className="size-4 shrink-0 text-primary sm:size-5" /></CardContent>
          <p className="mt-3 text-[11px] leading-4 text-muted-foreground">{description}</p>
        </Card>
      </Link>)}
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
