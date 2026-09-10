'use client';

import Link from 'next/link';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, LoadFailure, PageSkeleton } from './ui';
import { ApiError } from '@/lib/api';
import { useAdminMechanic } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

export function AdminMechanicDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const { data, error, isLoading, mutate } = useAdminMechanic(id);
  if (isLoading) return <PageSkeleton label={messages.mechanicsTitle} />;
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState><p>{messages.mechanicNotFound}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/mechanics">{messages.backToMechanics}</Link></Button></EmptyState>;
  }
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-3"><Link href="/admin/mechanics">{messages.backToMechanics}</Link></Button>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{messages.eyebrow}</p>
        <h1 className="font-display text-2xl font-semibold">{data.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.email}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {!data.active ? <Badge variant="secondary">{messages.mechanicInactive}</Badge> : null}
          <Badge variant="outline">{messages.readOnly}</Badge>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{messages.capabilitiesLabel}</CardTitle>
          <CardDescription>{data.capabilities.join(', ') || '—'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{messages.openAssignments}: {data.openWorkOrderCount}</p>
          <p>{messages.completedJobsCount}: {data.completedJobCount}</p>
          <p className="text-muted-foreground">{messages.jobLaborUnavailable}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{messages.openAssignments}</CardTitle></CardHeader>
        <CardContent>
          {data.currentAssignments.length ? (
            <ul className="divide-y">
              {data.currentAssignments.map((assignment) => (
                <li key={assignment.workOrderId} className="py-2 first:pt-0">
                  <Link className="font-semibold text-primary hover:underline" href={`/admin/work-orders/${assignment.workOrderId}`}>{assignment.displayId}</Link>
                  <p className="text-sm text-muted-foreground">{assignment.truckNumber} · {assignment.primaryCategoryName}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">{messages.noOpenAssignments}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{messages.recentClosedWorkOrders}</CardTitle></CardHeader>
        <CardContent>
          {data.recentClosedWorkOrders.length ? (
            <ul className="divide-y">
              {data.recentClosedWorkOrders.map((assignment) => (
                <li key={assignment.workOrderId} className="py-2 first:pt-0">
                  <Link className="font-semibold text-primary hover:underline" href={`/admin/work-orders/${assignment.workOrderId}`}>{assignment.displayId}</Link>
                  <p className="text-sm text-muted-foreground">{assignment.truckNumber} · {assignment.primaryCategoryName} · {assignment.status}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">{messages.noRecentClosedWorkOrders}</p>}
        </CardContent>
      </Card>
      <p className="sr-only">{locale}</p>
    </div>
  );
}
