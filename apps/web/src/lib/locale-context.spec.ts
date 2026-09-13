import { describe, expect, it } from 'vitest';
import { adminPauseReasonLabel, getAdminMessages } from './admin-messages';
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
    expect(getShopCopy('en').pauseReason).toEqual({
      waiting_for_parts: 'Waiting for Parts',
      waiting_for_approval: 'Waiting for Approval',
      waiting_for_vendor: 'Waiting for Vendor',
      waiting_for_equipment: 'Waiting for Equipment / Tool',
      waiting_for_bay: 'Waiting for Bay',
      waiting_for_driver: 'Waiting for Driver',
      truck_unavailable: 'Truck Unavailable',
      working_on_another_wo: 'Working on Another Work Order',
      break: 'Break',
      end_of_shift: 'End of Shift',
      other: 'Other',
    });
    expect(getShopCopy('es').pauseReason).toEqual({
      waiting_for_parts: 'En espera de piezas',
      waiting_for_approval: 'En espera de aprobación',
      waiting_for_vendor: 'En espera del proveedor',
      waiting_for_equipment: 'En espera de equipo o herramienta',
      waiting_for_bay: 'En espera de bahía',
      waiting_for_driver: 'En espera del conductor',
      truck_unavailable: 'Truck no disponible',
      working_on_another_wo: 'Trabajando en otro Work Order',
      break: 'Descanso',
      end_of_shift: 'Fin del turno',
      other: 'Otro',
    });
    for (const reason of Object.keys(getShopCopy('en').pauseReason) as Array<keyof ReturnType<typeof getShopCopy>['pauseReason']>) {
      expect(getShopCopy('en').pauseReason[reason]).toBe(adminPauseReasonLabel(reason, getAdminMessages('en')));
      expect(getShopCopy('es').pauseReason[reason]).toBe(adminPauseReasonLabel(reason, getAdminMessages('es')));
    }
  });
});
