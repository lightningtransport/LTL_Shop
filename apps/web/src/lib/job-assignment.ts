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
