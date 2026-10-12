import { describe, expect, it } from 'vitest';
import { WorkPlanJobLane } from '@ltl-shop/shared';
import { getAdminMessages } from './admin-messages-catalog';
import { truckNextStepActionLabel, truckNextStepText } from './truck-next-step';

const en = getAdminMessages('en');
const es = getAdminMessages('es');

describe('truckNextStepText (LTR-159)', () => {
  it('words every kind from the one API rule, in EN and ES', () => {
    expect(truckNextStepText({ kind: 'resolve_blocker', jobName: 'Detailing', reason: 'waiting_for_parts' }, en)).toBe('Blocked · Detailing: Waiting for Parts');
    expect(truckNextStepText({ kind: 'add_missing_steps', missingLanes: [WorkPlanJobLane.PM, WorkPlanJobLane.QUALITY_CHECK] }, en)).toBe('This Work Order is missing: PM, Quality Check.');
    expect(truckNextStepText({ kind: 'assign', jobName: 'Alignment' }, es)).toBe('Nadie asignado a Alignment.');
    expect(truckNextStepText({ kind: 'work', jobName: 'PM A Service', remaining: 3 }, en)).toBe('3 Jobs left · next: PM A Service');
    expect(truckNextStepText({ kind: 'close' }, es)).toContain('Cierra el Work Order');
    expect(truckNextStepText(null, en)).toBeNull();
  });

  it('labels the action; plain work in progress has none', () => {
    expect(truckNextStepActionLabel({ kind: 'close' }, en)).toBe('Close Work Order');
    expect(truckNextStepActionLabel({ kind: 'assign', jobName: 'x' }, es)).toBe('Asignar');
    expect(truckNextStepActionLabel({ kind: 'work' }, en)).toBeNull();
  });
});
