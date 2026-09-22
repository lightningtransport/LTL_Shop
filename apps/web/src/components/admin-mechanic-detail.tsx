'use client';

import Link from 'next/link';
import { UserRole } from '@ltl-shop/shared';
import { MechanicCapabilityEditor } from './admin-mechanic-roster';
import { AdminWriteTip } from './admin-write-tip';
import { AdminBackLink, AdminPageHeader, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, CompactEmpty, EmptyState, LoadFailure, PageSkeleton } from './ui';
import { ApiError } from '@/lib/api';
import { useAdminMechanic } from '@/lib/admin-data';
import { useAuth } from '@/lib/auth-context';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { isSystemAdmin } from '@/lib/system-admin';

export function AdminMechanicDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useAdminMechanic(id);
  const canEditRoster = isSystemAdmin(user) && data?.role === UserRole.MECHANIC;
  if (isLoading) return <PageSkeleton label={messages.mechanicsTitle} />;
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState><p>{messages.mechanicNotFound}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/mechanics">{messages.backToMechanics}</Link></Button></EmptyState>;
  }
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  return (
    <div className="space-y-5">
      <AdminBackLink href="/admin/mechanics">{messages.backToMechanics}</AdminBackLink>
      <AdminPageHeader
        eyebrow={messages.eyebrow}
        title={data.name}
        subtitle={data.email}
        badges={<>{!data.active ? <Badge variant="secondary">{messages.mechanicInactive}</Badge> : null}{canEditRoster ? null : <Badge variant="outline">{messages.readOnly}</Badge>}</>}
      />
      {canEditRoster ? <AdminWriteTip testId>{messages.mechanicRosterTip}</AdminWriteTip> : null}
      {canEditRoster ? <MechanicCapabilityEditor mechanic={data} messages={messages} onSaved={() => void mutate()} /> : null}
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
                  <p className="font-display text-base font-semibold text-primary">{assignment.truckNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {messages.workOrder}{' '}
                    <Link className="font-medium text-foreground hover:underline" href={`/admin/work-orders/${assignment.workOrderId}`}>{assignment.displayId}</Link>
                    {' · '}
                    {assignment.primaryCategoryName}
                  </p>
                </li>
              ))}
            </ul>
          ) : <CompactEmpty>{messages.noOpenAssignments}</CompactEmpty>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{messages.recentClosedWorkOrders}</CardTitle></CardHeader>
        <CardContent>
          {data.recentClosedWorkOrders.length ? (
            <ul className="divide-y">
              {data.recentClosedWorkOrders.map((assignment) => (
                <li key={assignment.workOrderId} className="py-2 first:pt-0">
                  <p className="font-display text-base font-semibold text-primary">{assignment.truckNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {messages.workOrder}{' '}
                    <Link className="font-medium text-foreground hover:underline" href={`/admin/work-orders/${assignment.workOrderId}`}>{assignment.displayId}</Link>
                    {' · '}
                    {assignment.primaryCategoryName} · {assignment.status}
                  </p>
                </li>
              ))}
            </ul>
          ) : <CompactEmpty>{messages.noRecentClosedWorkOrders}</CompactEmpty>}
        </CardContent>
      </Card>
      <p className="sr-only">{locale}</p>
    </div>
  );
}
