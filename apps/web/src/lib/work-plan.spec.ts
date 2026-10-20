import {
  JobStatus,
  WorkPlanInspectionOutcome,
  WorkPlanJobLane,
  WorkPlanJobUiStatus,
  WorkPlanMandatoryStatus,
  WorkPlanNotReadyReason,
  WorkPlanPhase,
  WorkPlanReadiness,
  type TruckWorkPlanDto,
} from '@ltl-shop/shared';
import { describe, expect, it } from 'vitest';
import { getAdminMessages } from './admin-messages-catalog';
import {
  draftContainsCatalogJob,
  draftContainsCustomName,
  existingWorkPlanCatalogJobIds,
  existingWorkPlanCustomNames,
  isDuplicateCustomOnPlan,
  workPlanJobUiStatusLabel,
  workPlanJobUiStatusVariant,
  workPlanMandatoryStatusLabel,
  workPlanMandatoryStatusVariant,
  workPlanPhaseLabel,
  workPlanReadyReasonMessage,
  workPlanRemainingSummary,
} from './work-plan';

const en = getAdminMessages('en');
const es = getAdminMessages('es');

function plan(overrides: Partial<TruckWorkPlanDto> = {}): TruckWorkPlanDto {
  return {
    sliceEnabled: true,
    inspection: { outcome: WorkPlanInspectionOutcome.NOT_STARTED },
    workOrder: null,
    jobs: [],
    remainingJobCount: 0,
    readiness: WorkPlanReadiness.NOT_READY,
    readyReason: WorkPlanNotReadyReason.INSPECTION_PENDING,
    phase: WorkPlanPhase.INSPECTION,
    mandatory: {
      pm: { required: true, status: WorkPlanMandatoryStatus.PENDING, jobCount: 0, remainingCount: 0 },
      alignment: { required: true, status: WorkPlanMandatoryStatus.PENDING, jobCount: 0, remainingCount: 0 },
      detailing: { required: true, status: WorkPlanMandatoryStatus.PENDING, jobCount: 0, remainingCount: 0 },
      qualityCheck: { required: true, status: WorkPlanMandatoryStatus.PENDING, jobCount: 0, remainingCount: 0 },
    },
    capabilities: { canRead: true, canAddWork: true, canRecordInspection: true },
    phase1: { assessmentId: null, gatesRemainDefault: true },
    ...overrides,
  };
}

describe('LTR-33 Work Plan copy helpers', () => {
  it('shows remaining count together with readyReason and mandatory Alignment/Detailing', () => {
    expect(workPlanRemainingSummary(2, en)).toBe('Not Ready — 2 remaining');
    expect(workPlanRemainingSummary(1, es)).toBe('Aún no está listo — faltan 1');
    expect(workPlanReadyReasonMessage('jobs_remaining', en)).toMatch(/Jobs/);
    expect(workPlanReadyReasonMessage('alignment_pending', es)).toContain('Alineación');
    expect(workPlanReadyReasonMessage('detailing_pending', es)).toContain('Detallado');
    expect(workPlanReadyReasonMessage('plan_complete', es)).toContain('Ready to Go');
    expect(workPlanMandatoryStatusLabel('pending', en)).toBe('Pending');
    expect(workPlanMandatoryStatusLabel('pending', es)).toBe('Pendiente');
    expect(workPlanMandatoryStatusLabel('in_progress', en)).toBe('In Progress');
    expect(workPlanMandatoryStatusLabel('in_progress', es)).toBe('En progreso');
    expect(workPlanMandatoryStatusLabel('complete', en)).toBe('Complete');
    expect(workPlanMandatoryStatusLabel('complete', es)).toBe('Completo');
    expect(workPlanMandatoryStatusLabel('not_applicable', es)).toBe('No aplica');
    expect(workPlanMandatoryStatusVariant('pending')).toBe('outline');
    expect(workPlanMandatoryStatusVariant('in_progress')).toBe('default');
    expect(workPlanMandatoryStatusVariant('complete')).toBe('success');
    expect(workPlanMandatoryStatusVariant('not_applicable')).toBe('secondary');
  });

  it('maps job UI statuses to existing Badge variants and Pending / In Progress / Completed', () => {
    expect(workPlanJobUiStatusVariant('pending')).toBe('outline');
    expect(workPlanJobUiStatusVariant('in_progress')).toBe('default');
    expect(workPlanJobUiStatusVariant('completed')).toBe('success');
    expect(workPlanJobUiStatusVariant('cancelled')).toBe('secondary');
    expect(workPlanJobUiStatusLabel('pending', en)).toBe('Pending');
    expect(workPlanJobUiStatusLabel('in_progress', en)).toBe('In Progress');
    expect(workPlanJobUiStatusLabel('completed', en)).toBe('Completed');
    expect(workPlanJobUiStatusLabel('pending', es)).toBe('Pendiente');
    expect(workPlanPhaseLabel('shop_work', en)).toBe('Shop Work');
    expect(workPlanPhaseLabel('shop_work', es)).toBe('Trabajo de taller');
    expect(workPlanPhaseLabel('inspection', es)).toBe('Inspección');
  });

  it('keeps Truck / Work Order / Ready to Go in Spanish Work Plan copy', () => {
    expect(es.workPlanDescription).toContain('Truck');
    expect(es.workPlanDescription).toContain('Work Order');
    expect(es.workPlanReadyAutomatic).toContain('Ready to Go');
    expect(es.workPlanOpenWorkOrder).toContain('Work Order');
    expect(es.workPlanReady).toBe('Ready to Go');
    expect(es.workPlanIssuesFoundHelp).toContain('Truck');
    expect(es.workPlanInspectionTitle).toBe('Inspección');
    expect(es.workPlanJobPending).toBe('Pendiente');
    expect(es.workPlanJobInProgress).toBe('En progreso');
    expect(es.yardSearch).toContain('Truck');
    expect(es.yardLoadMore).toContain('Trucks');
    expect(es.readyToGo).toBe('Ready to Go');
  });

  it('treats catalog and custom drafts as duplicates against the open plan', () => {
    const current = plan({
      jobs: [
        {
          id: 'j1',
          catalogJobId: 'cat-1',
          displayName: 'Brake Inspection',
          customDescription: null,
          category: { id: 'c1', name: 'Air & Brake System' },
          status: JobStatus.TO_DO,
          uiStatus: WorkPlanJobUiStatus.PENDING,
          lane: WorkPlanJobLane.SHOP_WORK,
        },
        {
          id: 'j2',
          catalogJobId: null,
          displayName: 'Detailing',
          customDescription: 'Detailing',
          category: { id: 'c2', name: 'Other' },
          status: JobStatus.TO_DO,
          uiStatus: WorkPlanJobUiStatus.PENDING,
          lane: WorkPlanJobLane.DETAILING,
        },
      ],
    });
    expect(existingWorkPlanCatalogJobIds(current)).toEqual(['cat-1']);
    expect(existingWorkPlanCustomNames(current)).toEqual(['Detailing']);
    expect(isDuplicateCustomOnPlan(['Detailing'], ' detailing ')).toBe(true);
    expect(draftContainsCatalogJob([{
      key: '1', catalogJobId: 'cat-1', categoryId: 'c1', categoryName: 'Air & Brake System', displayName: 'Brake Inspection',
    }], 'cat-1')).toBe(true);
    expect(draftContainsCustomName([{
      key: '1', categoryId: 'c2', categoryName: 'Other', displayName: 'Detailing', customDescription: 'Detailing',
    }], 'Detailing')).toBe(true);
  });
});
