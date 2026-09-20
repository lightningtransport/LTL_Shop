export type JobAssignee = { id: string; name: string } | null | undefined;

export function isMyAssignedOrInheritedJob(
  assignedMechanic: JobAssignee,
  currentUserId: string,
): boolean {
  return !assignedMechanic || assignedMechanic.id === currentUserId;
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
