export type JobAssignee = { id: string; name: string } | null | undefined;

export function isMyAssignedOrInheritedJob(
  assignedMechanic: JobAssignee,
  currentUserId: string,
): boolean {
  return !assignedMechanic || assignedMechanic.id === currentUserId;
}

/**
 * LTR-151: the PM job is finished only by its assigned PM mechanic, from the PM service. The Standard
 * Work Order view never offers "Complete job" on it to anyone else (the API rejects it anyway).
 */
export function canCompleteJobFromWorkOrder(
  job: { id: string; assignedMechanic: JobAssignee },
  pmJobId: string | null | undefined,
  currentUserId: string,
): boolean {
  if (!pmJobId || job.id !== pmJobId) return true;
  return Boolean(job.assignedMechanic && job.assignedMechanic.id === currentUserId);
}

export function jobAssignmentLabel(
  assignedMechanic: JobAssignee,
  currentUserId: string,
  copy: {
    assignedToYou: string;
    assignedTo: (name: string) => string;
    jobUnassignedInheritsTeam: string;
  },
): string {
  if (!assignedMechanic) return copy.jobUnassignedInheritsTeam;
  if (assignedMechanic.id === currentUserId) return copy.assignedToYou;
  return copy.assignedTo(assignedMechanic.name);
}

/**
 * LTR-127: a completed Job shows who completed it; the assignment line only
 * applies to Jobs still to do.
 */
export function jobPersonLabel(
  job: { status: string; assignedMechanic: JobAssignee; completedBy?: JobAssignee },
  currentUserId: string,
  copy: {
    assignedToYou: string;
    assignedTo: (name: string) => string;
    jobUnassignedInheritsTeam: string;
    completedByYou: string;
    completedBy: (name: string) => string;
  },
): string {
  if (job.status === 'completed' && job.completedBy) {
    return job.completedBy.id === currentUserId ? copy.completedByYou : copy.completedBy(job.completedBy.name);
  }
  return jobAssignmentLabel(job.assignedMechanic, currentUserId, copy);
}

export function workOrderTeamLabel(
  mechanics: { mechanicName: string }[] | undefined,
  copy: { workOrderTeam: string; noWorkOrderTeam: string },
): string {
  const names = (mechanics ?? []).map((mechanic) => mechanic.mechanicName).filter(Boolean);
  if (!names.length) return copy.noWorkOrderTeam;
  return `${copy.workOrderTeam}: ${names.join(' / ')}`;
}

/** Standard jobs are done; the Work Order stays in progress until a Manager closes it. */
export function isStandardWorkWaitingOnManager(wo: {
  status: string;
  primaryCategoryName: string;
  jobs: Array<{ status: string }>;
}): boolean {
  if (wo.primaryCategoryName === 'PM') return false;
  if (wo.status !== 'in_progress') return false;
  return wo.jobs.every((job) => job.status !== 'to_do');
}
