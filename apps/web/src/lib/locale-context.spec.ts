import { describe, expect, it } from 'vitest';
import { getShopCopy } from './locale-context';

describe('shop locale catalogs', () => {
  it('keeps English and Spanish mechanic assignment keys in parity', () => {
    expect(Object.keys(getShopCopy('en'))).toEqual(Object.keys(getShopCopy('es')));
    expect(getShopCopy('en').jobUnassignedInheritsTeam).toContain('inherits the Work Order team');
    expect(getShopCopy('es').jobUnassignedInheritsTeam).toContain('hereda el equipo');
    expect(getShopCopy('en').workspaceUnavailable).toMatch(/not available/);
    expect(getShopCopy('es').openAllowedHome).toMatch(/Inicio/);
    expect(getShopCopy('en').startWork).toBe('Start Work');
    expect(getShopCopy('es').startWork).toBe('Iniciar trabajo');
    expect(getShopCopy('en').pauseWorkOrder).toBe('Pause Work Order');
    expect(getShopCopy('es').pauseWorkOrder).toBe('Pausar Work Order');
    expect(getShopCopy('en').workOrderAction('Start Work', 'WO-1001', '905')).toBe('Start Work WO-1001, truck 905');
    expect(getShopCopy('es').workOrderAction(getShopCopy('es').startWork, 'WO-1001', '905')).toBe('Iniciar trabajo WO-1001, unidad 905');
    expect(getShopCopy('en').lastReportedLocation).toBe('Last reported location');
    expect(getShopCopy('es').lastReportedLocation).toBe('Ubicación reportada');
    expect(getShopCopy('en').locationUpdatedOn).toBe('Last reported on');
    expect(getShopCopy('es').locationUpdatedOn).toBe('Reportada el');
    expect(getShopCopy('en').lastReportedLocation.toLowerCase()).not.toContain('yard');
    expect(getShopCopy('es').lastReportedLocation.toLowerCase()).not.toContain('yard');
    expect(getShopCopy('en').locationUpdatedOn.toLowerCase()).not.toContain('yard');
    expect(getShopCopy('es').locationUpdatedOn.toLowerCase()).not.toContain('yard');
    expect(getShopCopy('en').status.created).toBe('Created');
    expect(getShopCopy('en').status.in_progress).toBe('In Progress');
    expect(getShopCopy('es').status.created).toBe('Creado');
    expect(getShopCopy('es').status.in_progress).toBe('En progreso');
    expect(getShopCopy('es').status.waiting_paused).toBe('Pausado');
    expect(getShopCopy('es').status.completed).toBe('Completado');
  });
});
