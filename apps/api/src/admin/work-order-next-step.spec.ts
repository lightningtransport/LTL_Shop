import { describe, expect, it } from 'vitest';
import { deriveTruckNextStep } from '@ltl-shop/shared';
import { deriveWorkPlan } from './yard-work-plan-derivation';
import { workOrderNextStep, type NextStepWorkOrderRow } from './work-order-next-step';

const alex = { id: 'alex', name: 'Alex' };
type Job = { id: string; displayName: string; status: string; category: { id: string; name: string }; owner?: typeof alex | null };
const job = (id: string, categoryName: string, displayName: string, status = 'to_do', owner: typeof alex | null = alex): Job => ({
  id, displayName, status, category: { id: `cat-${categoryName}`, name: categoryName }, owner,
});
const fullPlan = (): Job[] => [
  job('j-brake', 'Air & Brake System', 'Brake adjustment'),
  job('j-pm', 'PM', 'PM A Service'),
  job('j-al', 'Suspension & Steering', 'Alignment'),
  job('j-de', 'Detailing', 'Detailing'),
  job('j-qc', 'Quality Check', 'Quality Check', 'to_do', null),
];

type Scenario = { name: string; status: string; jobs: Job[]; inspection: string | null; blocker?: boolean; expected: string };
const scenarios: Scenario[] = [
  { name: 'truck 905: an old Work Order without the mandatory steps', status: 'in_progress', jobs: [job('j-brake', 'Air & Brake System', 'Brake adjustment')], inspection: 'completed', expected: 'add_missing_steps' },
  { name: 'active blocker on a Job', status: 'in_progress', jobs: fullPlan(), inspection: 'completed', blocker: true, expected: 'resolve_blocker' },
  { name: 'inspection not recorded yet', status: 'created', jobs: fullPlan().filter((item) => item.id !== 'j-brake'), inspection: null, expected: 'inspect' },
  { name: 'a pending Job without an owner', status: 'in_progress', jobs: fullPlan().map((item) => (item.id === 'j-al' ? { ...item, owner: null } : item)), inspection: 'completed', expected: 'assign' },
  { name: 'only Quality Check left', status: 'in_progress', jobs: fullPlan().map((item) => (item.id === 'j-qc' ? item : { ...item, status: 'completed' })), inspection: 'completed', expected: 'qc' },
  { name: 'everything done', status: 'in_progress', jobs: fullPlan().map((item) => ({ ...item, status: 'completed' })), inspection: 'completed', expected: 'close' },
  { name: 'mechanics still working', status: 'in_progress', jobs: fullPlan(), inspection: 'completed', expected: 'work' },
];

const blockerEvent = {
  id: 'b-1', reason: 'waiting_for_parts', blockerReason: 'waiting_for_parts', isOfficialPause: false,
  endedAt: new Date(), resolvedAt: null, startedAt: new Date('2026-09-28T10:00:00Z'),
  job: { id: 'j-de', displayName: 'Detailing' }, reportedBy: { name: 'Alex' },
};

/** How each surface loads the Work Order today (different Prisma shapes). */
function yardRow(s: Scenario): NextStepWorkOrderRow {
  return {
    id: 'wo-905', status: s.status, primaryCategory: { name: 'Air & Brake System' },
    jobs: s.jobs.map((item) => ({ ...item, catalogJobId: null, customDescription: null, assignedMechanic: item.owner ?? null })),
    pauseEvents: s.blocker ? [blockerEvent] : [],
  };
}
function dashboardRow(s: Scenario): NextStepWorkOrderRow {
  // Admin summary selects the owner id only, and the category name.
  return {
    id: 'wo-905', status: s.status, primaryCategory: { name: 'Air & Brake System' },
    jobs: s.jobs.map((item) => ({ id: item.id, status: item.status, displayName: item.displayName, category: { name: item.category.name }, assignedMechanicId: item.owner?.id ?? null })),
    pauseEvents: s.blocker ? [blockerEvent] : [],
  };
}
function truckListRow(s: Scenario): NextStepWorkOrderRow {
  return {
    id: 'wo-905', status: s.status, primaryCategory: { name: 'Air & Brake System' },
    jobs: s.jobs.map((item) => ({ id: item.id, status: item.status, displayName: item.displayName, category: item.category, assignedMechanicId: item.owner?.id ?? null })),
    pauseEvents: s.blocker ? [blockerEvent] : [],
  };
}
/** Truck Detail's Work Plan path (LTR-158), kept here as the reference. */
function truckDetailKind(s: Scenario) {
  const plan = deriveWorkPlan({
    workOrder: { id: 'wo-905', displayId: 'WO-905', status: s.status as never, version: 1, primaryCategoryName: 'Air & Brake System' },
    jobs: s.jobs.map((item) => ({ id: item.id, catalogJobId: null, displayName: item.displayName, customDescription: null, category: item.category, status: item.status as never, assignedMechanic: item.owner ?? null })),
    inspectionRequirementOutcome: s.inspection as never,
  });
  return deriveTruckNextStep({
    workOrder: { id: 'wo-905', status: s.status },
    inspectionOutcome: plan.inspection.outcome,
    jobs: plan.jobs,
    activeBlocker: s.blocker ? { ...blockerEvent, startedAt: blockerEvent.startedAt.toISOString() } : null,
  })?.kind;
}

describe('one Next step on every surface (LTR-159 contract)', () => {
  it.each(scenarios)('$name → $expected on Truck, Dashboard, Work Order, Yard and Truck list', (scenario) => {
    const options = { inspectionRequirementOutcome: scenario.inspection };
    const kinds = {
      truckDetail: truckDetailKind(scenario),
      yard: workOrderNextStep(yardRow(scenario), options)?.kind,
      dashboardAndList: workOrderNextStep(dashboardRow(scenario), options)?.kind,
      workOrderDetail: workOrderNextStep(yardRow(scenario), { ...options, returnedToService: false })?.kind,
      truckList: workOrderNextStep(truckListRow(scenario), options)?.kind,
    };
    expect(kinds).toEqual({
      truckDetail: scenario.expected,
      yard: scenario.expected,
      dashboardAndList: scenario.expected,
      workOrderDetail: scenario.expected,
      truckList: scenario.expected,
    });
  });

  it('a completed Work Order waits for Return to Service until the truck leaves; legacy PM has no steps', () => {
    const done = { ...yardRow(scenarios[5]), status: 'completed' };
    expect(workOrderNextStep(done)?.kind).toBe('return_to_service');
    expect(workOrderNextStep(done, { returnedToService: true })).toBeNull();
    expect(workOrderNextStep({ ...done, status: 'in_progress', primaryCategory: { name: 'PM' } })).toBeNull();
  });
});
