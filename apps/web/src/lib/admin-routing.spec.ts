import { describe, expect, it } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import { postLoginPath } from './admin-routing';
import { adminPauseReasonLabel, getAdminMessages } from './admin-messages';

describe('Shop Admin routing and messages', () => {
  const admin = { capabilities: [AppCapability.ADMIN_ACCESS] };
  const standard = { capabilities: [AppCapability.MECHANIC_STANDARD] };
  const pm = { capabilities: [AppCapability.MECHANIC_PM] };

  it('routes Admin-capable users to the requested Admin destination', () => {
    expect(postLoginPath(admin, '/admin')).toBe('/admin');
    expect(postLoginPath(admin, '/admin/work-orders?status=open')).toBe(
      '/admin/work-orders?status=open',
    );
  });

  it('routes each mechanic capability to its explicit workspace', () => {
    expect(postLoginPath(standard, '/admin')).toBe('/mechanic/standard');
    expect(postLoginPath(pm)).toBe('/mechanic/pm');
  });

  it('does not accept an external redirect target', () => {
    expect(postLoginPath(admin, '//example.com/admin')).toBe('/admin');
  });

  it('keeps multi-workspace users landing in Admin', () => {
    expect(postLoginPath({ capabilities: Object.values(AppCapability) })).toBe('/admin');
  });

  it('keeps one typed message shape for English and Spanish', () => {
    expect(Object.keys(getAdminMessages('en'))).toEqual(Object.keys(getAdminMessages('es')));
    expect(getAdminMessages('en').filters).toBe('Filters');
    expect(getAdminMessages('es').filters).toBe('Filtros');
    expect(getAdminMessages('en').moreFilters).toBe('More filters');
    expect(getAdminMessages('es').moreFilters).toBe('Más filtros');
    expect(getAdminMessages('en').currentOperations).toBe('Current shop operations');
    expect(getAdminMessages('es').currentOperations).toBe('Operaciones actuales del Shop');
    expect(getAdminMessages('en').generatedAtLabel).toBe('Updated');
    expect(getAdminMessages('es').generatedAtLabel).toBe('Actualizado');
    for (const locale of ['en', 'es'] as const) {
      expect(getAdminMessages(locale).currentOperations.toLowerCase()).not.toMatch(/supabase|postgres/);
    }
    expect(getAdminMessages('es').nextPhaseBody).toContain('Work Orders');
    expect(getAdminMessages('es').nextPhaseBody).toContain('unidades');
    expect(getAdminMessages('en').dashboard).toBe('Dashboard');
    expect(getAdminMessages('en').workOrders).toBe('Work Orders');
    expect(getAdminMessages('en').yardOperations).toBe('Yard Operations');
    expect(getAdminMessages('en').trucks).toBe('Trucks');
    expect(getAdminMessages('es').dashboard).toBe('Operaciones');
    expect(getAdminMessages('es').workOrders).toBe('Work Orders');
    expect(getAdminMessages('es').yardOperations).toBe('Operaciones del patio');
    expect(getAdminMessages('es').trucks).toBe('Unidades');
    expect(getAdminMessages('es').mechanics).toBe('Mecánicos');
    expect(getAdminMessages('es').jobCatalog).toBe('Catálogo de Jobs');
    expect(getAdminMessages('es').history).toBe('Historial');
    expect(getAdminMessages('en').lastReportedLocation).toBe('Last reported location');
    expect(getAdminMessages('es').lastReportedLocation).toBe('Ubicación reportada');
    expect(getAdminMessages('en').locationUpdatedOn).toBe('Last reported on');
    expect(getAdminMessages('es').locationUpdatedOn).toBe('Reportada el');
    expect(getAdminMessages('en').lastReportedLocation.toLowerCase()).not.toContain('in yard');
    expect(getAdminMessages('es').lastReportedLocation.toLowerCase()).not.toContain('en el yard');
    expect(getAdminMessages('en').locationUpdatedOn.toLowerCase()).not.toContain('in yard');
    expect(getAdminMessages('es').locationUpdatedOn.toLowerCase()).not.toContain('en el yard');
    expect(getAdminMessages('en').lastReportedLocation.toLowerCase()).not.toContain('presence');
    expect(getAdminMessages('es').lastReportedLocation.toLowerCase()).not.toContain('presencia');
    expect(getAdminMessages('en').yardOperationsPhase1Body).toBe(
      'Reporting feeds Work location, Incoming Trucks, and Upcoming Departures. This view also shows maintenance readiness — not physical yard presence or dispatch.',
    );
    expect(getAdminMessages('es').yardOperationsPhase1Body).toBe(
      'Reporting alimenta Ubicación de trabajo, Incoming Trucks y Salidas próximas. Esta vista también muestra readiness de mantenimiento — no presencia física en el yard ni despacho.',
    );
    expect(getAdminMessages('es').yardIncomingTrucks).toBe('Incoming Trucks');
    expect(getAdminMessages('es').incomingTrucksUnavailable).toBe('Incoming Trucks no disponibles');
    expect(getAdminMessages('en').yardOperationsPhase1Body.toLowerCase()).not.toContain('in the yard');
    expect(getAdminMessages('es').yardOperationsPhase1Body.toLowerCase()).not.toContain('en el patio');
    expect(adminPauseReasonLabel('waiting_for_parts', getAdminMessages('en'))).toBe('Waiting for Parts');
    expect(adminPauseReasonLabel('waiting_for_parts', getAdminMessages('es'))).toBe('En espera de piezas');
    expect(adminPauseReasonLabel('waiting_for_equipment', getAdminMessages('en'))).toBe('Waiting for Equipment / Tool');
    expect(adminPauseReasonLabel('working_on_another_wo', getAdminMessages('es'))).toBe('Trabajando en otro Work Order');
    expect(adminPauseReasonLabel('other', getAdminMessages('es'))).toBe('Otro');
    expect(getAdminMessages('en').closeAssessment).toBe('End review');
    expect(getAdminMessages('es').closeAssessment).toBe('Terminar revisión');
    expect(getAdminMessages('en').unevaluatedGatesBanner).toContain('Not required');
    expect(getAdminMessages('es').outcomeHelpRequired).toContain('Ready to Go');
    expect(getAdminMessages('es').requiredNextStepNeedsWo).toContain('Work Order');
  });
});
