import { describe, expect, it } from 'vitest';
import { getAdminMessages } from './admin-messages';
import { externalShopLabel } from './external-shop';
import { truckNextStepText } from './truck-next-step';
import { workPlanJobUiStatusLabel, workPlanJobUiStatusVariant } from './work-plan';

describe('external shop copy (LTR-188 / D24)', () => {
  it('names what went out, in both languages', () => {
    expect(externalShopLabel('part', getAdminMessages('es'))).toBe('En taller externo · pieza');
    expect(externalShopLabel('truck', getAdminMessages('es'))).toBe('En taller externo · camión');
    expect(externalShopLabel('truck', getAdminMessages('en'))).toBe('At external shop · truck');
  });

  it('words the "external" Next step and the Work Plan status', () => {
    const es = getAdminMessages('es');
    expect(truckNextStepText({ kind: 'external', workOrderId: 'wo', jobId: 'j', jobName: 'Air Dryer', externalKind: 'part' }, es))
      .toBe('En taller externo: Air Dryer');
    expect(workPlanJobUiStatusLabel('external', es)).toBe('En taller externo');
    expect(workPlanJobUiStatusVariant('external')).toBe('warning');
  });
});
