import { describe, expect, it } from 'vitest';
import { getShopCopy } from './locale-context';

describe('shop locale catalogs', () => {
  it('keeps English and Spanish mechanic assignment keys in parity', () => {
    expect(Object.keys(getShopCopy('en'))).toEqual(Object.keys(getShopCopy('es')));
    expect(getShopCopy('en').jobUnassignedInheritsTeam).toContain('inherits the Work Order team');
    expect(getShopCopy('es').jobUnassignedInheritsTeam).toContain('hereda el equipo');
    expect(getShopCopy('en').workspaceUnavailable).toMatch(/not available/);
    expect(getShopCopy('es').openAllowedHome).toMatch(/Inicio/);
    expect(getShopCopy('en').workOrderAction('Start Work', 'WO-1001', '905')).toBe('Start Work WO-1001, truck 905');
    expect(getShopCopy('en').lastReportedLocation).toBe('Last reported location');
    expect(getShopCopy('es').lastReportedLocation).toBe('Ubicación reportada');
    expect(getShopCopy('en').lastReportedLocation.toLowerCase()).not.toContain('yard');
    expect(getShopCopy('es').lastReportedLocation.toLowerCase()).not.toContain('yard');
  });
});
