import { describe, expect, it } from 'vitest';
import { ADMIN_LOCALE_COOKIE } from './admin-session';
import { adminPauseReasonLabel, getAdminMessages } from './admin-messages';
import { getShopCopy } from './locale-context';
import {
  parseShopLocale,
  SHOP_LOCALE_COOKIE,
  SHOP_LOCALE_COOKIE_MAX_AGE,
  shopLocaleCookieWrite,
  shopLocaleFromCookieHeader,
} from './shop-locale';

describe('shared shop locale cookie', () => {
  it('uses one cookie name for mechanic and Admin', () => {
    expect(SHOP_LOCALE_COOKIE).toBe('ltl_shop_locale');
    expect(ADMIN_LOCALE_COOKIE).toBe(SHOP_LOCALE_COOKIE);
  });

  it('parses only en and es, defaulting unknown values to en', () => {
    expect(parseShopLocale('es')).toBe('es');
    expect(parseShopLocale('en')).toBe('en');
    expect(parseShopLocale('fr')).toBe('en');
    expect(parseShopLocale(undefined)).toBe('en');
  });

  it('reads the shared cookie from a document cookie header', () => {
    expect(shopLocaleFromCookieHeader(`${SHOP_LOCALE_COOKIE}=es; other=1`)).toBe('es');
    expect(shopLocaleFromCookieHeader(`${SHOP_LOCALE_COOKIE}=en`)).toBe('en');
    expect(shopLocaleFromCookieHeader('unrelated=es')).toBe('en');
  });

  it('writes Path=/ and a long Max-Age so login, Home, and Admin share the same cookie', () => {
    expect(shopLocaleCookieWrite('es')).toBe(
      `${SHOP_LOCALE_COOKIE}=es; Path=/; Max-Age=${SHOP_LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`,
    );
    expect(shopLocaleCookieWrite('en')).toContain('Path=/');
    expect(SHOP_LOCALE_COOKIE_MAX_AGE).toBeGreaterThanOrEqual(31_536_000);
  });
});

describe('shop locale catalogs', () => {
  it('keeps English and Spanish Admin New WO job-picker keys in parity', () => {
    expect(Object.keys(getAdminMessages('en'))).toEqual(Object.keys(getAdminMessages('es')));
    expect(getAdminMessages('en').noJobsInCategory).toMatch(/Category/);
    expect(getAdminMessages('es').noJobsInCategory).toMatch(/Category/);
    expect(getAdminMessages('en').addCatalogJob).toBe('Add');
    expect(getAdminMessages('es').addCatalogJob).toBe('Agregar');
    expect(getAdminMessages('en').jobPickerCategoryLabel).toBe('Job Category');
    expect(getAdminMessages('es').jobPickerCategoryLabel).toBe('Categoría de Job');
    expect(getAdminMessages('en').woStatusPaused).toBe('Paused');
    expect(getAdminMessages('es').woStatusPaused).toBe('Pausado');
    expect(getAdminMessages('en').jobStatusToDo).toBe('To do');
    expect(getAdminMessages('es').jobStatusToDo).toBe('Por hacer');
    expect(getAdminMessages('en').workPlanIssuesFound).toBe('Issues found');
    expect(getAdminMessages('es').workPlanNoIssuesFound).toBe('Sin hallazgos');
    expect(getAdminMessages('en').workPlanNotReadyRemaining).toContain('{count}');
    expect(getAdminMessages('es').workPlanReady).toBe('Ready to Go');
    expect(getAdminMessages('es').readyToGo).toBe('Ready to Go');
    expect(getAdminMessages('en').closeDialog).toBe('Close');
    expect(getAdminMessages('es').closeDialog).toBe('Cerrar');
    expect(getAdminMessages('en').readyToCloseHint).toMatch(/Confirm completion/);
    expect(getAdminMessages('es').readyToCloseHint).toMatch(/finalización/);
    expect(getAdminMessages('en').attentionBody).toMatch(/ready to close/);
    expect(getAdminMessages('es').yardSearch).toMatch(/Truck/);
    expect(getAdminMessages('en').noTrucksInPhase).toMatch(/this phase/);
    expect(getAdminMessages('es').noTrucksInPhase).toMatch(/esta fase/);
    expect(getAdminMessages('es').workPlanJobPending).toBe('Pendiente');
    expect(getAdminMessages('es').workPlanInspectionTitle).toBe('Inspección');
    expect(getAdminMessages('es').emptyCategoryCustomHint).toMatch(/Job/);
    expect(getAdminMessages('en').emptyCategoryCustomHint).toMatch(/custom Job/);
    expect(getAdminMessages('en').activityPmDetailsUpdated).toBe('PM details updated');
    expect(getAdminMessages('es').activityBlockerReported).toBe('Bloqueo reportado');
    expect(getAdminMessages('en').pauseWorkOrderBadRequest).toMatch(/pending Jobs cannot be paused/);
    expect(getAdminMessages('es').pauseWorkOrderBadRequest).toMatch(/Jobs pendientes/);
    expect(getAdminMessages('en').pauseWorkOrderBadRequest).not.toBe(getAdminMessages('en').assignmentBadRequest);
    expect(getAdminMessages('es').pauseWorkOrderBadRequest).not.toBe(getAdminMessages('es').assignmentBadRequest);
  });

  it('uses the Flujo v3 vocabulary and drops retired wording in both catalogs (LTR-152)', () => {
    const catalogs = [getAdminMessages('en'), getAdminMessages('es'), getShopCopy('en'), getShopCopy('es')];
    for (const catalog of catalogs) {
      const text = Object.values(catalog).filter((value) => typeof value === 'string').join('\n');
      expect(text).not.toMatch(/inherit|hereda el equipo/i);
      expect(text).not.toMatch(/Mandatory for every yard Truck|Obligatorio para cada Truck del yard/);
      expect(text).not.toMatch(/operational status from recorded service-status events|según eventos de servicio registrados/);
      expect(text).not.toMatch(/Under review|En revisión/);
    }
    const expected = {
      en: { jobStatusPending: 'Pending', jobStatusInProgress: 'In progress', jobStatusBlocked: 'Blocked', woStatusPaused: 'Paused', jobUnassigned: 'Unassigned', inspectionStep: 'Inspection' },
      es: { jobStatusPending: 'Pendiente', jobStatusInProgress: 'En curso', jobStatusBlocked: 'Bloqueado', woStatusPaused: 'Pausado', jobUnassigned: 'Sin asignar', inspectionStep: 'Inspección' },
    } as const;
    for (const locale of ['en', 'es'] as const) {
      expect(getAdminMessages(locale)).toMatchObject(expected[locale]);
      expect(getShopCopy(locale)).toMatchObject(expected[locale]);
    }
  });

  it('keeps English and Spanish mechanic assignment keys in parity', () => {
    expect(Object.keys(getShopCopy('en'))).toEqual(Object.keys(getShopCopy('es')));
    expect(getShopCopy('en').jobUnassigned).toBe('Unassigned');
    expect(getShopCopy('es').jobUnassigned).toBe('Sin asignar');
    expect(getShopCopy('en').workspaceUnavailable).toMatch(/not available/);
    expect(getShopCopy('es').openAllowedHome).toMatch(/Inicio/);
    expect(getShopCopy('en').searchJobsLabel).toBe('Search jobs in this category');
    expect(getShopCopy('es').noJobsInCategory).toMatch(/Category/);
    expect(getShopCopy('en').addCatalogJob).toBe('Add');
    expect(getShopCopy('es').addCustomJob).toMatch(/personalizado/);
    expect(getShopCopy('en').multiSelectDone).toBe('Done');
    expect(getShopCopy('es').multiSelectDone).toBe('Listo');
    expect(getShopCopy('en').jobFinishedSuccess).toBe('Job marked complete.');
    expect(getShopCopy('es').jobFinishedWithNoteSuccess).toMatch(/nota/);
    expect(getShopCopy('en').workStartedSuccess).toBe('Work started.');
    // LTR-155 / D17: only the Manager resolves a blocker.
    expect(getShopCopy('es').blockerReportedSuccess).toMatch(/Manager/);
    expect(getShopCopy('es').pausedJobsTitle).toBe('Pausada por el Manager');
    expect(getAdminMessages('en').createWorkOrderSuccess).toContain('{id}');
    expect(getAdminMessages('es').createWorkOrderSuccess).toContain('{id}');
    expect(getShopCopy('en').pauseWorkOrder).toBe('Pause Work Order');
    expect(getShopCopy('es').pauseWorkOrder).toBe('Pausar Work Order');
    expect(getShopCopy('en').pauseUnavailableUntilInProgress).toMatch(/In Progress/);
    expect(getShopCopy('es').pauseUnavailableUntilInProgress).toMatch(/En progreso/);
    expect(getAdminMessages('en').pauseUnavailableUntilInProgress).toBe(getShopCopy('en').pauseUnavailableUntilInProgress);
    expect(getAdminMessages('es').pauseUnavailableUntilInProgress).toBe(getShopCopy('es').pauseUnavailableUntilInProgress);
    expect(getShopCopy('en').workOrderAction('Start Work', 'WO-1001', '905')).toBe('Start Work truck 905, Work Order WO-1001');
    expect(getShopCopy('es').workOrderAction(getShopCopy('es').startWork, 'WO-1001', '905')).toBe('Iniciar trabajo unidad 905, Work Order WO-1001');
    expect(getShopCopy('en').lastReportedLocation).toBe('Last reported location');
    expect(getShopCopy('es').lastReportedLocation).toBe('Ubicación reportada');
    expect(getShopCopy('en').locationUpdatedOn).toBe('Last reported on');
    expect(getShopCopy('es').locationUpdatedOn).toBe('Reportada el');
    expect(getShopCopy('en').lastReportedLocation.toLowerCase()).not.toContain('yard');
    expect(getShopCopy('es').lastReportedLocation.toLowerCase()).not.toContain('yard');
    expect(getShopCopy('en').locationUpdatedOn.toLowerCase()).not.toContain('yard');
    expect(getShopCopy('es').locationUpdatedOn.toLowerCase()).not.toContain('yard');
    expect(getShopCopy('en').loadingWorkOrder).toBe('Loading work order');
    expect(getShopCopy('es').retryWorkOrder).toBe('Reintentar Work Order');
    expect(getShopCopy('en').viewWork).toBe('View Work');
    expect(getShopCopy('es').viewDetails).toBe('Ver detalles');
    expect(getShopCopy('en').closeDialog).toBe('Close');
    expect(getShopCopy('es').closeDialog).toBe('Cerrar');
    expect(getShopCopy('es').waitingOnManagerBody).toMatch(/Manager cierra/);
    expect(getShopCopy('en').workOptions).toBe('Work Options');
    expect(getShopCopy('es').activeJobsTitle).toBe('En curso');
    expect(getShopCopy('en').pmPausedTitle).toBe('Paused PM services');
    expect(getShopCopy('es').pmPausedTitle).toBe('Servicios de PM pausados');
    expect(getShopCopy('en').pmActiveTitle).toBe('Active PM services');
    expect(getShopCopy('es').pmActiveTitle).toBe('Servicios de PM activos');
    expect(getShopCopy('en').pausedPmServices(1)).toBe('1 paused PM service');
    expect(getShopCopy('en').pausedPmServices(2)).toBe('2 paused PM services');
    expect(getShopCopy('es').pausedPmServices(1)).toBe('1 servicio de PM pausado');
    expect(getShopCopy('es').pausedPmServices(2)).toBe('2 servicios de PM pausados');
    expect(getShopCopy('en').noPausedPmServices).not.toMatch(/job/i);
    expect(getShopCopy('es').noPausedPmServices).not.toMatch(/Jobs/i);
    expect(getShopCopy('en').notes).toBe('Notes');
    expect(getShopCopy('es').notes).toBe('Notas');
    expect(getShopCopy('en').saveNotes).toBe('Save Notes');
    expect(getShopCopy('es').unableToSaveNotes).toBe('No se pudieron guardar las notas.');
    expect(getShopCopy('en').pauseReasonLabel).toBe('Pause reason');
    expect(getShopCopy('es').pauseReasonLabel).toBe('Motivo de pausa');
    expect(getShopCopy('en').selectOption).toBe('Select an option');
    expect(getShopCopy('es').selectOption).toBe('Selecciona una opción');
    expect(getShopCopy('en').reasonRequiredForOther).toBe('Reason required for Other');
    expect(getShopCopy('es').reasonRequiredForOther).toBe('Motivo obligatorio para Otro');
    expect(getShopCopy('en').unableToSavePmDetails).toBe('Unable to save PM service details.');
    expect(getShopCopy('es').unableToSavePmDetails).toMatch(/servicio de PM/);
    expect(getShopCopy('en').truckInformation).toBe('Truck Information');
    expect(getShopCopy('es').truckInformation).toBe('Información de la unidad');
    expect(getShopCopy('en').priorityLabel).toBe('Priority');
    expect(getShopCopy('es').priorityLabel).toBe('Prioridad');
    expect(getShopCopy('en').priority.low).toBe('Low');
    expect(getShopCopy('es').priority.critical).toBe('Crítica');
    expect(getShopCopy('en').jobStatus.to_do).toBe('To do');
    expect(getShopCopy('es').jobStatus.to_do).toBe('Por hacer');
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
