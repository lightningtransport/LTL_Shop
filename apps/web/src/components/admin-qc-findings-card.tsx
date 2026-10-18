'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { AdminQcFindingDto, AdminWorkOrderDetailDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { Button, InlineAlert, Input, SectionCard, Select } from './ui';
import { addAdminQcFindingToJob, dismissAdminQcFinding } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { adminWriteFailureMessage } from '@/lib/system-admin';
import { adminTruckHref } from '@/lib/admin-truck-origin';

/**
 * D46 / SQ-3 (LTR-232): what Safety found at the Quality Check, on the Work Order. Each open finding goes to a new Job
 * (Add work on the Truck, where it is offered with its suggested Job), to a Job already here, or is set aside with a
 * reason. Handled ones say how. Signed "Safety" only: the Shop never sees who (D46).
 */
export function AdminQcFindingsCard({ data, messages, canManage, onChanged }: {
  data: AdminWorkOrderDetailDto;
  messages: AdminMessages;
  canManage: boolean;
  onChanged: (next: AdminWorkOrderDetailDto) => void;
}) {
  const findings = data.qcFindings ?? [];
  if (!findings.length) return null;
  const open = findings.filter((finding) => !finding.resolvedAt);
  return (
    <SectionCard title={<><ShieldCheck aria-hidden="true" className="size-4" />{messages.qcFindingsTitle}</>} count={open.length || undefined} data-testid="admin-qc-findings">
      <ul className="divide-y text-sm">
        {findings.map((finding) => (
          <FindingRow key={finding.id} finding={finding} data={data} messages={messages} canManage={canManage} onChanged={onChanged} />
        ))}
      </ul>
    </SectionCard>
  );
}

function FindingRow({ finding, data, messages, canManage, onChanged }: {
  finding: AdminQcFindingDto;
  data: AdminWorkOrderDetailDto;
  messages: AdminMessages;
  canManage: boolean;
  onChanged: (next: AdminWorkOrderDetailDto) => void;
}) {
  const { showToast } = useActionToast();
  const [jobId, setJobId] = useState('');
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openJobs = data.jobs.filter((job) => job.status === 'to_do' && !job.helperOfJobId);

  async function act(run: () => Promise<AdminWorkOrderDetailDto>, done: string) {
    setBusy(true);
    setError(null);
    try {
      onChanged(await run());
      showToast('success', done);
    } catch (failure) {
      setError(adminWriteFailureMessage(failure, { locale: messages.locale, apiError: messages.apiError, forbidden: messages.pcWriteForbidden, conflict: messages.pcWriteConflict, failed: messages.pcWriteFailed }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="space-y-2 px-4 py-3" data-testid="admin-qc-finding">
      <p>
        “{finding.text}”
        <span className="block text-xs text-muted-foreground">
          {finding.kind === 'blocking' ? messages.qcFindingBlocking : messages.qcFindingNote}
          {finding.catalogJob && !finding.resolvedAt ? ` · ${fillPlaceholders(messages.qcFindingSuggests, { job: finding.catalogJob.displayName })}` : ''}
        </span>
      </p>
      {finding.resolvedAt ? (
        <p className="text-xs text-muted-foreground" data-testid="admin-qc-finding-resolved">
          {finding.resolution === 'dismissed'
            ? fillPlaceholders(messages.qcFindingSetAside, { reason: finding.dismissReason ?? '' })
            : fillPlaceholders(messages.qcFindingInJob, { job: finding.resolvedJob?.displayName ?? '—' })}
        </p>
      ) : canManage ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <AdminNavLink href={`${adminTruckHref(data.truck.id, `/admin/work-orders/${data.id}`)}#add-work`}>{messages.qcFindingNewJob}</AdminNavLink>
            </Button>
            {openJobs.length ? (
              <>
                <Select aria-label={messages.qcFindingChooseJob} value={jobId} disabled={busy} onChange={(event) => setJobId(event.target.value)} className="max-w-56">
                  <option value="">{messages.qcFindingChooseJob}</option>
                  {openJobs.map((job) => <option key={job.id} value={job.id}>{job.displayName}</option>)}
                </Select>
                <Button size="sm" variant="outline" disabled={busy || !jobId} onClick={() => void act(() => addAdminQcFindingToJob(data.id, finding.id, jobId), messages.qcFindingAdded)}>
                  {messages.qcFindingAddToJob}
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDismissing((value) => !value)}>{messages.qcFindingNotNow}</Button>
          </div>
          {dismissing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input aria-label={messages.qcFindingReason} placeholder={messages.qcFindingReason} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} className="max-w-72" />
              <Button size="sm" disabled={busy || !reason.trim()} onClick={() => void act(() => dismissAdminQcFinding(data.id, finding.id, reason.trim()), messages.qcFindingDismissedToast)}>
                {messages.qcFindingSetAsideAction}
              </Button>
            </div>
          ) : null}
          {error ? <InlineAlert>{error}</InlineAlert> : null}
        </div>
      ) : null}
    </li>
  );
}
