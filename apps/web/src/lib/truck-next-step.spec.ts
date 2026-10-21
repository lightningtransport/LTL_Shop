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

  it('D52 (LTR-260): says when Samsara saw a Ready to Go truck leave the yard or come back', () => {
    expect(truckNextStepText({ kind: 'return_to_service' }, en)).toBe('Ready to Go. Return it to service when it leaves the shop.');
    expect(truckNextStepText({ kind: 'return_to_service', yardMove: { kind: 'left_yard', at: '2026-10-15T14:40:00.000Z' } }, en))
      .toBe('Left the yard Oct 15, 10:40 AM (Samsara). Confirm Return to Service.');
    expect(truckNextStepText({ kind: 'return_to_service', yardMove: { kind: 'back_in_yard', at: '2026-10-15T13:05:00.000Z' } }, es))
      .toMatch(/^Volvió a la yard 15 oct.*9:05.*sin Return to Service\. Confírmalo y abre un Work Order\.$/);
  });

  it('labels the action; plain work in progress has none', () => {
    expect(truckNextStepActionLabel({ kind: 'close' }, en)).toBe('Close Work Order');
    expect(truckNextStepActionLabel({ kind: 'assign', jobName: 'x' }, es)).toBe('Asignar');
    expect(truckNextStepActionLabel({ kind: 'work' }, en)).toBeNull();
  });
});
