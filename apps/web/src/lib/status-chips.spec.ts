import { describe, expect, it } from 'vitest';
import { ActivityEventType, JobStatus, Priority, ReadinessPhase, WorkOrderStatus } from '@ltl-shop/shared';
import { getAdminMessages } from './admin-messages';
import {
  adminActivityEventLabel,
  adminPriorityLabel,
  jobStatusLabel,
  jobStatusVariant,
  phaseLabel,
  phaseVariant,
  priorityVariant,
  workOrderStatusLabel,
  workOrderStatusVariant,
} from './status-chips';

describe('LTR-23 status chips', () => {
  const en = getAdminMessages('en');
  const es = getAdminMessages('es');

  it('maps Work Order status to the signed Badge variants and singular catalog', () => {
    expect(workOrderStatusVariant(WorkOrderStatus.CREATED)).toBe('outline');
    expect(workOrderStatusVariant(WorkOrderStatus.IN_PROGRESS)).toBe('default');
    expect(workOrderStatusVariant(WorkOrderStatus.WAITING_PAUSED)).toBe('warning');
    expect(workOrderStatusVariant(WorkOrderStatus.COMPLETED)).toBe('success');
    expect(workOrderStatusVariant(WorkOrderStatus.CANCELLED)).toBe('secondary');
    expect(workOrderStatusLabel(WorkOrderStatus.CREATED, en)).toBe('Created');
    expect(workOrderStatusLabel(WorkOrderStatus.CREATED, es)).toBe('Creado');
    expect(workOrderStatusLabel(WorkOrderStatus.WAITING_PAUSED, en)).toBe('Paused');
    expect(workOrderStatusLabel(WorkOrderStatus.WAITING_PAUSED, es)).toBe('Pausado');
    expect(workOrderStatusLabel(WorkOrderStatus.IN_PROGRESS, es)).toBe('En progreso');
  });

  it('maps Job status including to_do', () => {
    expect(jobStatusVariant(JobStatus.TO_DO)).toBe('outline');
    expect(jobStatusVariant(JobStatus.COMPLETED)).toBe('success');
    expect(jobStatusVariant(JobStatus.CANCELLED)).toBe('secondary');
    expect(jobStatusLabel(JobStatus.TO_DO, en)).toBe('To do');
    expect(jobStatusLabel(JobStatus.TO_DO, es)).toBe('Por hacer');
  });

  it('maps Priority to distinct variants', () => {
    expect(priorityVariant(Priority.LOW)).toBe('secondary');
    expect(priorityVariant(Priority.NORMAL)).toBe('outline');
    expect(priorityVariant(Priority.HIGH)).toBe('warning');
    expect(priorityVariant(Priority.CRITICAL)).toBe('destructive');
    expect(adminPriorityLabel(Priority.LOW, es)).toBe('Baja');
    expect(adminPriorityLabel(Priority.CRITICAL, es)).toBe('Crítica');
  });

  it('colors phase chips by ReadinessPhase, not blockers', () => {
    expect(phaseVariant(ReadinessPhase.NEEDS_EVALUATION)).toBe('warning');
    expect(phaseVariant(ReadinessPhase.INSPECTION)).toBe('outline');
    expect(phaseVariant(ReadinessPhase.REQUIRED_WORK)).toBe('outline');
    expect(phaseVariant(ReadinessPhase.PM)).toBe('outline');
    expect(phaseVariant(ReadinessPhase.READY_FOR_APPROVAL)).toBe('warning');
    expect(phaseVariant(ReadinessPhase.READY_TO_GO)).toBe('success');
    expect(phaseLabel(ReadinessPhase.READY_TO_GO, en)).toBe('Ready to Go');
    expect(phaseLabel(ReadinessPhase.READY_FOR_APPROVAL, es)).toBe('Listo para aprobación');
  });

  it('maps activity eventType to catalog labels and never returns snake_case for known events', () => {
    expect(adminActivityEventLabel(ActivityEventType.BLOCKER_REPORTED, en)).toBe('Blocker reported');
    expect(adminActivityEventLabel(ActivityEventType.BLOCKER_REPORTED, es)).toBe('Bloqueo reportado');
    expect(adminActivityEventLabel(ActivityEventType.PM_DETAILS_UPDATED, en)).toBe('PM details updated');
    expect(adminActivityEventLabel(ActivityEventType.PM_DETAILS_UPDATED, es)).toBe('Detalles de PM actualizados');
    expect(adminActivityEventLabel(ActivityEventType.WORK_ORDER_CREATED, en)).toBe('Work Order created');
    expect(adminActivityEventLabel('unknown_event', en)).toBe('Activity recorded');
    expect(adminActivityEventLabel('unknown_event', es)).toBe('Actividad registrada');
    expect(adminActivityEventLabel(ActivityEventType.PM_DETAILS_UPDATED, en)).not.toMatch(/_/);
  });
});
