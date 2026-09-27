'use client';

import * as React from 'react';
import { PauseReason } from '@ltl-shop/shared';
import {
  parseShopLocale,
  shopLocaleChangeEvent,
  shopLocaleCookieWrite,
  shopLocaleFromCookieHeader,
  type ShopLocale,
} from './shop-locale';

export type { ShopLocale } from './shop-locale';
export { SHOP_LOCALE_COOKIE, parseShopLocale, shopLocaleCookieWrite } from './shop-locale';

type Copy = {
  locale: ShopLocale;
  language: string;
  switchTo: string;
  home: string;
  backToHome: string;
  retry: string;
  signIn: string;
  signInHint: string;
  email: string;
  password: string;
  resetPassword: string;
  devLogin: string;
  newWorkOrder: string;
  newPmService: string;
  workOrder: string;
  workOrderHint: string;
  pmServiceHint: string;
  truck: string;
  searchTruck: string;
  noTrucks: string;
  checkingOpenWorkOrder: string;
  retryWorkOrderCheck: string;
  truckInformation: string;
  selectTruck: string;
  vin: string;
  lastReportedLocation: string;
  locationUpdatedOn: string;
  repairHistory: string;
  openWorkOrder: string;
  noAccessToPmWorkOrder: string;
  chooseAnotherWorkOrder: string;
  workOrderOpen: (truckNumber: string) => string;
  workOrderSummary: (displayId: string, status: string, completed: number, total: number) => string;
  truckResults: (count: number) => string;
  activeJobs: (count: number) => string;
  pausedJobs: (count: number) => string;
  activePmServices: (count: number) => string;
  pausedPmServices: (count: number) => string;
  noActiveJobs: string;
  noPausedJobs: string;
  noPausedPmServices: string;
  activeJobsTitle: string;
  pausedJobsTitle: string;
  pmActiveTitle: string;
  pmPausedTitle: string;
  notes: string;
  saveNotes: string;
  notesOptional: string;
  notesPlaceholder: string;
  unableToSaveNotes: string;
  priorityLabel: string;
  pauseReasonLabel: string;
  selectOption: string;
  reasonRequiredForOther: string;
  additionalDetails: string;
  unableToSavePmDetails: string;
  waitingOnManager: string;
  waitingOnManagerHint: (count: number) => string;
  waitingOnManagerBody: string;
  workOptions: string;
  assignedToYou: string;
  assignedTo: (name: string) => string;
  completedByYou: string;
  completedBy: (name: string) => string;
  jobUnassignedInheritsTeam: string;
  myJobs: string;
  otherWorkOnThisTruck: string;
  workOrderTeam: string;
  noWorkOrderTeam: string;
  noMyJobs: string;
  createWorkOrder: string;
  searchJobsLabel: string;
  categoryJobsLabel: string;
  noJobsInCategory: string;
  noMatchingCategoryJobs: string;
  loadingJobs: string;
  loadError: string;
  customJobPlaceholder: string;
  addCustomJob: string;
  addCatalogJob: string;
  checkingTruck: string;
  chooseCategory: string;
  addJobToContinue: string;
  askManagerToCreate: string;
  askManagerToCreateHint: string;
  additionalWorkHint: string;
  jobFinishNotes: string;
  jobFinishNotesPlaceholder: string;
  pausedAskManager: string;
  createPmService: string;
  viewCompletedWork: (count: number) => string;
  workspaceUnavailable: string;
  openAllowedHome: string;
  startWork: string;
  startingWork: string;
  workStartedSuccess: string;
  reportBlocker: string;
  activeBlockers: string;
  markBlockerResolved: string;
  blockerResolved: string;
  noteThreadEmpty: string;
  notePlaceholder: string;
  addNote: string;
  requestWork: string;
  noteAddedSuccess: string;
  workRequestSentSuccess: string;
  workRequestLabel: string;
  workRequestPending: string;
  workRequestHandledBy: (name: string) => string;
  notesClosed: string;
  requestWorkHint: string;
  reportingBlocker: string;
  blockerReportedSuccess: string;
  blockerReason: string;
  jobFinishTitle: string;
  jobFinishConfirm: string;
  completingJob: string;
  jobFinishedSuccess: string;
  jobFinishedWithNoteSuccess: string;
  dismissNotice: string;
  closeDialog: string;
  pauseWorkOrder: string;
  workOrderAction: (action: string, displayId: string, truckNumber: string) => string;
  pmServiceLoadError: string;
  loadingPmService: string;
  currentTruckMileage: string;
  lastCompletedPm: string;
  truckMileageToday: string;
  previousPm: string;
  mileageAtThisPm: string;
  pmCompletedOn: (date: string) => string;
  noPartsRecorded: string;
  noPriorPm: string;
  mileageNotRecorded: string;
  observedMileage: string;
  enterMileageHint: string;
  mileageBelowCurrent: (current: string) => string;
  mileageJumpWarning: (current: string) => string;
  confirmMileage: string;
  partsUsed: string;
  noPartUsed: string;
  noCompatibleParts: string;
  saving: string;
  saved: string;
  restoringSession: string;
  loadingWorkOrders: string;
  loadingWorkOrder: string;
  retryWorkOrder: string;
  unableToLoadProfile: string;
  unableToLoadWorkOrders: string;
  homeSubtitle: string;
  pmHomeTitle: string;
  standardHomeTitle: string;
  pmHomeSubtitle: string;
  standardHomeSubtitle: string;
  readyToStart: string;
  ordersReadyToStart: (count: number) => string;
  noActivePmServices: string;
  pmServicesStartImmediately: string;
  viewDetails: string;
  resumeWork: string;
  viewWork: string;
  finishWork: string;
  continuePmService: string;
  pmStartedAt: (time: string) => string;
  pmAlreadyRunning: (displayId: string) => string;
  pmJoinAdd: (displayId: string) => string;
  pmJoinJoin: (displayId: string) => string;
  pmJoinMine: (displayId: string) => string;
  pmJoinTaken: (displayId: string, name: string) => string;
  pmJoinDone: (displayId: string) => string;
  joinPmService: string;
  finishingWork: string;
  pmFinishedSuccess: string;
  viewCompletedWorkAction: string;
  jobsDone: (completed: number, total: number) => string;
  truckTitle: (truckNumber: string) => string;
  startPmService: string;
  pmServiceStartedSuccess: string;
  pmJobFinishedHint: string;
  pmJobFinishRequirement: string;
  pmJobNotStartedHint: string;
  pmJobOnWorkOrder: (job: string, workOrder: string) => string;
  startWorkToCompleteJobs: string;
  laborTime: (duration: string) => string;
  laborRunningLabel: string;
  pmServiceLabel: string;
  noPendingJobs: string;
  noCompletedJobs: string;
  chooseAnotherOrHome: string;
  cancelAction: string;
  multiSelectDone: string;
  backToShopAdmin: string;
  workspaceStandard: string;
  workspacePm: string;
  shopWorkspaces: string;
  priority: Record<string, string>;
  jobStatus: Record<string, string>;
  status: Record<string, string>;
  pauseReason: Record<PauseReason, string>;
};

const copy: Record<ShopLocale, Copy> = {
  en: {
    locale: 'en', language: 'Language', switchTo: 'Switch to Spanish', home: 'Home',
    backToHome: 'Back to Home', retry: 'Try again', signIn: 'Sign in',
    signInHint: 'Sign in with the email linked to the Shop.', email: 'Email', password: 'Password',
    resetPassword: 'Reset password', devLogin: 'Dev login (local bypass)',
    newWorkOrder: 'New Work Order', newPmService: 'New PM service',
    workOrder: 'Work Order',
    workOrderHint: 'Enter the required information. Creating saves the order; Start Work begins labor.',
    pmServiceHint: 'Select a truck to create a PM service.', truck: 'Truck',
    searchTruck: 'Truck number, e.g. 905', noTrucks: 'No trucks found.',
    checkingOpenWorkOrder: 'Checking for an open Work Order.', retryWorkOrderCheck: 'Retry Work Order check',
    truckInformation: 'Truck Information', selectTruck: 'Select a truck to show its details.',
    vin: 'VIN', lastReportedLocation: 'Last reported location', locationUpdatedOn: 'Last reported on',
    repairHistory: 'View truck repair history', openWorkOrder: 'View open Work Order',
    noAccessToPmWorkOrder: 'You do not have access to this PM Work Order.',
    chooseAnotherWorkOrder: 'Choose another Work Order',
    workOrderOpen: (truckNumber) => `Truck #${truckNumber} already has an open Work Order.`,
    workOrderSummary: (displayId, status, completed, total) => `${displayId} · ${status} · ${completed} of ${total} jobs completed`,
    truckResults: (count) => `${count} ${count === 1 ? 'truck result' : 'truck results'} available.`,
    activeJobs: (count) => `${count} ${count === 1 ? 'Work Order' : 'Work Orders'} in progress`,
    pausedJobs: (count) => `${count} paused ${count === 1 ? 'Work Order' : 'Work Orders'}`,
    activePmServices: (count) => `${count} ${count === 1 ? 'active PM service' : 'active PM services'}`,
    pausedPmServices: (count) => `${count} ${count === 1 ? 'paused PM service' : 'paused PM services'}`,
    noActiveJobs: 'No assigned work in progress.',
    noPausedJobs: 'No paused Work Orders. Paused work will appear here until it is resumed.',
    noPausedPmServices: 'No paused PM services. Paused work will appear here until it is resumed.',
    activeJobsTitle: 'In Progress',
    pausedJobsTitle: 'Paused',
    pmActiveTitle: 'Active PM services',
    pmPausedTitle: 'Paused PM services',
    notes: 'Notes',
    saveNotes: 'Save Notes',
    notesOptional: 'Notes (optional)',
    notesPlaceholder: 'Describe or add any information needed to perform the work',
    unableToSaveNotes: 'Unable to save notes.',
    priorityLabel: 'Priority',
    pauseReasonLabel: 'Pause reason',
    selectOption: 'Select an option',
    reasonRequiredForOther: 'Reason required for Other',
    additionalDetails: 'Additional details',
    unableToSavePmDetails: 'Unable to save PM service details.',
    waitingOnManager: 'Waiting on Manager',
    waitingOnManagerHint: (count) => `${count} ${count === 1 ? 'Work Order is' : 'Work Orders are'} ready for the Manager to close`,
    waitingOnManagerBody: 'Jobs are done. Your Shop Manager closes this Work Order. You can still report a blocker if something is stopping the Truck.',
    assignedToYou: 'Assigned to you',
    assignedTo: (name) => `Assigned to ${name}`,
    completedByYou: 'Completed by you',
    completedBy: (name) => `Completed by ${name}`,
    jobUnassignedInheritsTeam: 'Unassigned — inherits the Work Order team',
    myJobs: 'My Jobs',
    otherWorkOnThisTruck: 'Other work on this Truck',
    workOrderTeam: 'Work Order team',
    noWorkOrderTeam: 'No Work Order team assigned',
    noMyJobs: 'No jobs assigned to you. Unassigned jobs inherit the Work Order team.',
    createWorkOrder: 'Create new Work Order',
    searchJobsLabel: 'Search jobs in this category',
    categoryJobsLabel: 'Jobs in this Category',
    noJobsInCategory: 'No Jobs are listed for this Category.',
    noMatchingCategoryJobs: 'No Jobs match this search.',
    loadingJobs: 'Loading jobs…',
    loadError: 'Unable to load this screen.',
    customJobPlaceholder: 'Custom job name',
    addCustomJob: 'Add custom job',
    addCatalogJob: 'Add',
    checkingTruck: 'Checking truck…',
    chooseCategory: 'Choose a category',
    addJobToContinue: 'Add a job to continue',
    askManagerToCreate: 'Ask your Shop Manager to create a Work Order.',
    askManagerToCreateHint: 'Managers plan Standard work. Your Home lists Work Orders assigned to you.',
    workOptions: 'Work Options',
    additionalWorkHint: 'Need additional work on this Truck? Use Request Work in Notes so your Manager can add the Job.',
    jobFinishNotes: 'Completion note',
    jobFinishNotesPlaceholder: 'What did you do? The Manager will see this.',
    pausedAskManager: 'This Work Order is paused. Your Shop Manager will resume it.',
    createPmService: 'Create PM service',
    viewCompletedWork: (count) => `View completed work (${count})`,
    workspaceUnavailable: 'This mechanic workspace is not available for your account.',
    openAllowedHome: 'Go to your Shop home',
    startWork: 'Start Work',
    startingWork: 'Starting…',
    workStartedSuccess: 'Work started.',
    reportBlocker: 'Report Blocker',
    activeBlockers: 'Active blockers',
    markBlockerResolved: 'Mark resolved',
    blockerResolved: 'Blocker resolved.',
    noteThreadEmpty: 'No notes yet.',
    notePlaceholder: 'Write a note, or describe additional work the Truck needs',
    addNote: 'Add Note',
    requestWork: 'Request Work',
    noteAddedSuccess: 'Note added.',
    workRequestSentSuccess: 'Work request sent to your Manager.',
    workRequestLabel: 'Work request',
    workRequestPending: 'Waiting for Manager',
    workRequestHandledBy: (name) => `Handled by ${name}`,
    notesClosed: 'This Work Order is closed. Notes are read-only.',
    requestWorkHint: 'Request Work goes to your Manager, who can add it as a Job. Notes are never overwritten.',
    reportingBlocker: 'Reporting…',
    blockerReportedSuccess: 'Blocker reported. The Work Order is not paused.',
    blockerReason: 'Blocker reason',
    jobFinishTitle: 'Complete job',
    jobFinishConfirm: 'Complete job',
    completingJob: 'Completing…',
    jobFinishedSuccess: 'Job marked complete.',
    jobFinishedWithNoteSuccess: 'Job marked complete. Your note is saved.',
    dismissNotice: 'Dismiss',
    closeDialog: 'Close',
    pauseWorkOrder: 'Pause Work Order',
    workOrderAction: (action, displayId, truckNumber) => `${action} truck ${truckNumber}, Work Order ${displayId}`,
    pmServiceLoadError: 'Unable to load PM service details.',
    loadingPmService: 'Loading PM service details…',
    currentTruckMileage: 'Current truck mileage',
    lastCompletedPm: 'Last completed PM',
    truckMileageToday: 'Truck mileage today',
    previousPm: 'Previous PM',
    mileageAtThisPm: 'Mileage recorded at this PM',
    pmCompletedOn: (date) => `PM completed ${date}`,
    noPartsRecorded: 'No parts recorded.',
    noPriorPm: 'No prior PM recorded',
    mileageNotRecorded: 'Mileage not recorded',
    observedMileage: 'Observed mileage',
    enterMileageHint: 'Enter the observed mileage to record parts used.',
    mileageBelowCurrent: (current) => `Observed mileage cannot be lower than the truck's current mileage (${current}). Check the odometer.`,
    mileageJumpWarning: (current) => `This is more than 50,000 mi above the truck's current mileage (${current}). Confirm the odometer reading.`,
    confirmMileage: 'Confirm mileage',
    partsUsed: 'Parts used',
    noPartUsed: 'No part used',
    noCompatibleParts: 'No compatible parts for this truck',
    saving: 'Saving…',
    saved: 'Saved',
    restoringSession: 'Restoring session',
    loadingWorkOrders: 'Loading work orders',
    loadingWorkOrder: 'Loading work order',
    retryWorkOrder: 'Retry work order',
    unableToLoadProfile: 'Unable to load your profile.',
    unableToLoadWorkOrders: 'Unable to load work orders',
    homeSubtitle: 'Current jobs, work orders, and recent work.',
    pmHomeTitle: 'PM Mechanic',
    standardHomeTitle: 'My Assigned Work',
    pmHomeSubtitle: 'PM services assigned to you.',
    standardHomeSubtitle: 'Work Orders and Jobs the Manager assigned to you.',
    readyToStart: 'Ready to Start',
    ordersReadyToStart: (count) => `${count} ${count === 1 ? 'order' : 'orders'} ready to Start Work`,
    noActivePmServices: 'No active PM services assigned to you.',
    pmServicesStartImmediately: 'PM services start immediately after creation.',
    viewDetails: 'View Details',
    resumeWork: 'Resume Work',
    viewWork: 'View Work',
    finishWork: 'Finish Work',
    continuePmService: 'Continue PM service',
    pmStartedAt: (time) => `Started ${time}`,
    pmAlreadyRunning: (displayId) => `Finish or pause ${displayId} before starting another PM service.`,
    pmJoinAdd: (displayId) => `This truck already has Work Order ${displayId}. Your PM service will be added to it.`,
    pmJoinJoin: (displayId) => `This truck already has Work Order ${displayId} with a PM job. You will take and start it.`,
    pmJoinMine: (displayId) => `You already started the PM on Work Order ${displayId}.`,
    pmJoinTaken: (displayId, name) => `The PM of Work Order ${displayId} is assigned to ${name}. Ask your Shop Manager if it should be yours.`,
    pmJoinDone: (displayId) => `The PM of Work Order ${displayId} is already done.`,
    joinPmService: 'Start PM on this Work Order',
    finishingWork: 'Finishing…',
    pmFinishedSuccess: 'PM service completed.',
    viewCompletedWorkAction: 'View completed work',
    jobsDone: (completed, total) => `${completed} of ${total} jobs done`,
    truckTitle: (truckNumber) => `Truck ${truckNumber}`,
    startPmService: 'Start PM service',
    pmServiceStartedSuccess: 'PM service started.',
    pmJobFinishedHint: 'This PM service is finished. The Shop Manager closes the Work Order.',
    pmJobFinishRequirement: 'Finish requires a saved observed mileage and at least one part.',
    pmJobNotStartedHint: 'Start the PM service to record the observed mileage and parts.',
    pmJobOnWorkOrder: (job, workOrder) => `${job} · Work Order ${workOrder}`,
    startWorkToCompleteJobs: 'Press Start Work to be able to complete Jobs.',
    laborTime: (duration) => `Labor time: ${duration}`,
    laborRunningLabel: 'running',
    pmServiceLabel: 'PM Service',
    noPendingJobs: 'No pending jobs',
    noCompletedJobs: 'No completed jobs',
    chooseAnotherOrHome: 'Choose another Work Order or return to Home.',
    cancelAction: 'Cancel',
    multiSelectDone: 'Done',
    backToShopAdmin: 'Back to Shop Admin',
    workspaceStandard: 'Standard',
    workspacePm: 'PM',
    shopWorkspaces: 'Shop workspaces',
    priority: { low: 'Low', normal: 'Normal', high: 'High', critical: 'Critical' },
    jobStatus: { to_do: 'To do', completed: 'Completed', cancelled: 'Cancelled' },
    status: { created: 'Created', in_progress: 'In Progress', waiting_paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled' },
    pauseReason: {
      [PauseReason.WAITING_FOR_PARTS]: 'Waiting for Parts',
      [PauseReason.WAITING_FOR_APPROVAL]: 'Waiting for Approval',
      [PauseReason.WAITING_FOR_VENDOR]: 'Waiting for Vendor',
      [PauseReason.WAITING_FOR_EQUIPMENT]: 'Waiting for Equipment / Tool',
      [PauseReason.WAITING_FOR_BAY]: 'Waiting for Bay',
      [PauseReason.WAITING_FOR_DRIVER]: 'Waiting for Driver',
      [PauseReason.TRUCK_UNAVAILABLE]: 'Truck Unavailable',
      [PauseReason.WORKING_ON_ANOTHER_WO]: 'Working on Another Work Order',
      [PauseReason.BREAK]: 'Break',
      [PauseReason.END_OF_SHIFT]: 'End of Shift',
      [PauseReason.OTHER]: 'Other',
    },
  },
  es: {
    locale: 'es', language: 'Idioma', switchTo: 'Cambiar a inglés', home: 'Inicio',
    backToHome: 'Volver a Inicio', retry: 'Reintentar', signIn: 'Iniciar sesión',
    signInHint: 'Inicia sesión con el correo vinculado al Shop.', email: 'Correo electrónico', password: 'Contraseña',
    resetPassword: 'Restablecer contraseña', devLogin: 'Acceso de desarrollo (bypass local)',
    newWorkOrder: 'Nuevo Work Order', newPmService: 'Nuevo servicio de PM',
    workOrder: 'Work Order',
    workOrderHint: 'Ingresa la información requerida. Crear guarda el Work Order; Iniciar trabajo comienza el registro de tiempo.',
    pmServiceHint: 'Selecciona una unidad para crear un servicio de PM.', truck: 'Unidad',
    searchTruck: 'Número de unidad, ej. 905', noTrucks: 'No se encontraron unidades.',
    checkingOpenWorkOrder: 'Verificando si hay un Work Order abierto.', retryWorkOrderCheck: 'Reintentar la verificación del Work Order',
    truckInformation: 'Información de la unidad', selectTruck: 'Selecciona una unidad para ver sus detalles.',
    vin: 'VIN', lastReportedLocation: 'Ubicación reportada', locationUpdatedOn: 'Reportada el',
    repairHistory: 'Ver historial de reparaciones de la unidad', openWorkOrder: 'Ver Work Order abierto',
    noAccessToPmWorkOrder: 'No tienes acceso a este Work Order de PM.',
    chooseAnotherWorkOrder: 'Elegir otro Work Order',
    workOrderOpen: (truckNumber) => `La unidad #${truckNumber} ya tiene un Work Order abierto.`,
    workOrderSummary: (displayId, status, completed, total) => `${displayId} · ${status} · ${completed} de ${total} Jobs completados`,
    truckResults: (count) => `${count} ${count === 1 ? 'resultado de unidad disponible.' : 'resultados de unidades disponibles.'}`,
    activeJobs: (count) => `${count} ${count === 1 ? 'Work Order' : 'Work Orders'} en curso`,
    pausedJobs: (count) => `${count} ${count === 1 ? 'Work Order' : 'Work Orders'} en pausa`,
    activePmServices: (count) => `${count} ${count === 1 ? 'servicio de PM activo' : 'servicios de PM activos'}`,
    pausedPmServices: (count) => `${count} ${count === 1 ? 'servicio de PM pausado' : 'servicios de PM pausados'}`,
    noActiveJobs: 'No hay trabajo asignado en progreso.',
    noPausedJobs: 'No hay Work Orders en pausa. El trabajo pausado aparecerá aquí hasta que se reanude.',
    noPausedPmServices: 'No hay servicios de PM pausados. El trabajo pausado aparecerá aquí hasta que se reanude.',
    activeJobsTitle: 'En curso',
    pausedJobsTitle: 'En pausa',
    pmActiveTitle: 'Servicios de PM activos',
    pmPausedTitle: 'Servicios de PM pausados',
    notes: 'Notas',
    saveNotes: 'Guardar notas',
    notesOptional: 'Notas (opcional)',
    notesPlaceholder: 'Describe o agrega cualquier información necesaria para realizar el trabajo',
    unableToSaveNotes: 'No se pudieron guardar las notas.',
    priorityLabel: 'Prioridad',
    pauseReasonLabel: 'Motivo de pausa',
    selectOption: 'Selecciona una opción',
    reasonRequiredForOther: 'Motivo obligatorio para Otro',
    additionalDetails: 'Detalles adicionales',
    unableToSavePmDetails: 'No se pudieron guardar los detalles del servicio de PM.',
    waitingOnManager: 'Espera al Manager',
    waitingOnManagerHint: (count) => count === 1
      ? '1 Work Order listo para que el Manager lo cierre'
      : `${count} Work Orders listos para que el Manager los cierre`,
    waitingOnManagerBody: 'Los Jobs están hechos. El Shop Manager cierra este Work Order. Si algo detiene la unidad, aún puedes reportar un bloqueo.',
    assignedToYou: 'Asignado a ti',
    assignedTo: (name) => `Asignado a ${name}`,
    completedByYou: 'Completado por ti',
    completedBy: (name) => `Completado por ${name}`,
    jobUnassignedInheritsTeam: 'Sin asignar — hereda el equipo de la Work Order',
    myJobs: 'Mis Jobs',
    otherWorkOnThisTruck: 'Otro trabajo en esta unidad',
    workOrderTeam: 'Equipo de la Work Order',
    noWorkOrderTeam: 'No hay equipo asignado a la Work Order',
    noMyJobs: 'No tienes Jobs asignados. Los Jobs sin asignar heredan el equipo de la Work Order.',
    createWorkOrder: 'Crear nuevo Work Order',
    searchJobsLabel: 'Buscar jobs en esta categoría',
    categoryJobsLabel: 'Jobs en esta Category',
    noJobsInCategory: 'No hay Jobs listados en esta Category.',
    noMatchingCategoryJobs: 'Ningún Job coincide con esta búsqueda.',
    loadingJobs: 'Cargando jobs…',
    loadError: 'No se pudo cargar esta pantalla.',
    customJobPlaceholder: 'Nombre de job personalizado',
    addCustomJob: 'Agregar job personalizado',
    addCatalogJob: 'Agregar',
    checkingTruck: 'Verificando camión…',
    chooseCategory: 'Elige una categoría',
    addJobToContinue: 'Agrega un job para continuar',
    askManagerToCreate: 'Pide a tu Shop Manager que cree el Work Order.',
    askManagerToCreateHint: 'El Manager planifica el trabajo Standard. En Inicio ves los Work Orders asignados a ti.',
    workOptions: 'Opciones de trabajo',
    additionalWorkHint: '¿Hace falta trabajo adicional en esta unidad? Usa Pedir trabajo en Notas para que el Manager agregue el Job.',
    jobFinishNotes: 'Nota al completar',
    jobFinishNotesPlaceholder: '¿Qué hiciste? El Manager verá esta nota.',
    pausedAskManager: 'Este Work Order está pausado. Tu Shop Manager lo reanudará.',
    createPmService: 'Crear servicio de PM',
    viewCompletedWork: (count) => `Ver trabajo completado (${count})`,
    workspaceUnavailable: 'Este espacio de mecánico no está disponible para tu cuenta.',
    openAllowedHome: 'Ir a tu Inicio del Shop',
    startWork: 'Iniciar trabajo',
    startingWork: 'Iniciando…',
    workStartedSuccess: 'Trabajo iniciado.',
    reportBlocker: 'Reportar bloqueo',
    activeBlockers: 'Bloqueos activos',
    markBlockerResolved: 'Marcar resuelto',
    blockerResolved: 'Bloqueo resuelto.',
    noteThreadEmpty: 'Aún no hay notas.',
    notePlaceholder: 'Escribe una nota o describe el trabajo adicional que necesita la unidad',
    addNote: 'Agregar nota',
    requestWork: 'Pedir trabajo',
    noteAddedSuccess: 'Nota agregada.',
    workRequestSentSuccess: 'Pedido de trabajo enviado a tu Manager.',
    workRequestLabel: 'Pedido de trabajo',
    workRequestPending: 'Esperando al Manager',
    workRequestHandledBy: (name) => `Atendido por ${name}`,
    notesClosed: 'Esta Work Order está cerrada. Las notas son de solo lectura.',
    requestWorkHint: 'Pedir trabajo le llega a tu Manager, que puede agregarlo como Job. Las notas nunca se sobrescriben.',
    reportingBlocker: 'Reportando…',
    blockerReportedSuccess: 'Bloqueo reportado. El Work Order no está pausado.',
    blockerReason: 'Motivo del bloqueo',
    jobFinishTitle: 'Completar Job',
    jobFinishConfirm: 'Completar Job',
    completingJob: 'Completando…',
    jobFinishedSuccess: 'Job marcado como completado.',
    jobFinishedWithNoteSuccess: 'Job marcado como completado. Tu nota quedó guardada.',
    dismissNotice: 'Cerrar',
    closeDialog: 'Cerrar',
    pauseWorkOrder: 'Pausar Work Order',
    workOrderAction: (action, displayId, truckNumber) => `${action} unidad ${truckNumber}, Work Order ${displayId}`,
    pmServiceLoadError: 'No se pudieron cargar los detalles del servicio de PM.',
    loadingPmService: 'Cargando detalles del servicio de PM…',
    currentTruckMileage: 'Millaje actual del camión',
    lastCompletedPm: 'Último PM completado',
    truckMileageToday: 'Millaje del camión hoy',
    previousPm: 'PM anterior',
    mileageAtThisPm: 'Millaje registrado en este PM',
    pmCompletedOn: (date) => `PM completado ${date}`,
    noPartsRecorded: 'No se registraron piezas.',
    noPriorPm: 'No hay PM anterior registrado',
    mileageNotRecorded: 'Millaje no registrado',
    observedMileage: 'Millaje observado',
    enterMileageHint: 'Ingresa el millaje observado para registrar las piezas usadas.',
    mileageBelowCurrent: (current) => `El millaje observado no puede ser menor al millaje actual del truck (${current}). Revisa el odómetro.`,
    mileageJumpWarning: (current) => `Son más de 50,000 mi sobre el millaje actual del truck (${current}). Confirma la lectura del odómetro.`,
    confirmMileage: 'Confirmar millaje',
    partsUsed: 'Piezas usadas',
    noPartUsed: 'No se usó ninguna pieza',
    noCompatibleParts: 'No hay piezas compatibles para este camión',
    saving: 'Guardando…',
    saved: 'Guardado',
    restoringSession: 'Restaurando sesión',
    loadingWorkOrders: 'Cargando Work Orders',
    loadingWorkOrder: 'Cargando Work Order',
    retryWorkOrder: 'Reintentar Work Order',
    unableToLoadProfile: 'No se pudo cargar tu perfil.',
    unableToLoadWorkOrders: 'No se pudieron cargar los Work Orders',
    homeSubtitle: 'Jobs actuales, Work Orders y trabajo reciente.',
    pmHomeTitle: 'Mecánico de PM',
    standardHomeTitle: 'Mi trabajo asignado',
    pmHomeSubtitle: 'Servicios de PM asignados a ti.',
    standardHomeSubtitle: 'Work Orders y Jobs que te asignó el Manager.',
    readyToStart: 'Listos para iniciar',
    ordersReadyToStart: (count) => `${count} ${count === 1 ? 'orden lista' : 'órdenes listas'} para Iniciar trabajo`,
    noActivePmServices: 'No hay servicios de PM activos asignados a ti.',
    pmServicesStartImmediately: 'Los servicios de PM comienzan inmediatamente después de crearse.',
    viewDetails: 'Ver detalles',
    resumeWork: 'Reanudar trabajo',
    viewWork: 'Ver trabajo',
    finishWork: 'Terminar trabajo',
    continuePmService: 'Continuar servicio PM',
    pmStartedAt: (time) => `Iniciado ${time}`,
    pmAlreadyRunning: (displayId) => `Termina o pausa ${displayId} antes de iniciar otro servicio PM.`,
    pmJoinAdd: (displayId) => `Esta unidad ya tiene el Work Order ${displayId}. Tu servicio PM se agregará ahí.`,
    pmJoinJoin: (displayId) => `Esta unidad ya tiene el Work Order ${displayId} con un job PM. Lo tomarás e iniciarás.`,
    pmJoinMine: (displayId) => `Ya iniciaste el PM en el Work Order ${displayId}.`,
    pmJoinTaken: (displayId, name) => `El PM del Work Order ${displayId} está asignado a ${name}. Pregunta a tu Shop Manager si debe ser tuyo.`,
    pmJoinDone: (displayId) => `El PM del Work Order ${displayId} ya está hecho.`,
    joinPmService: 'Iniciar PM en este Work Order',
    finishingWork: 'Terminando…',
    pmFinishedSuccess: 'Servicio de PM completado.',
    viewCompletedWorkAction: 'Ver trabajo completado',
    jobsDone: (completed, total) => `${completed} de ${total} Jobs completados`,
    truckTitle: (truckNumber) => `Unidad ${truckNumber}`,
    startPmService: 'Iniciar servicio PM',
    pmServiceStartedSuccess: 'Servicio PM iniciado.',
    pmJobFinishedHint: 'Este servicio PM está terminado. El Shop Manager cierra el Work Order.',
    pmJobFinishRequirement: 'Para terminar se necesita el millaje observado guardado y al menos una parte.',
    pmJobNotStartedHint: 'Inicia el servicio PM para registrar el millaje observado y las partes.',
    pmJobOnWorkOrder: (job, workOrder) => `${job} · Work Order ${workOrder}`,
    startWorkToCompleteJobs: 'Pulsa Iniciar trabajo para poder completar Jobs.',
    laborTime: (duration) => `Tiempo de labor: ${duration}`,
    laborRunningLabel: 'en curso',
    pmServiceLabel: 'Servicio de PM',
    noPendingJobs: 'No hay Jobs pendientes',
    noCompletedJobs: 'No hay Jobs completados',
    chooseAnotherOrHome: 'Elige otro Work Order o vuelve a Inicio.',
    cancelAction: 'Cancelar',
    multiSelectDone: 'Listo',
    backToShopAdmin: 'Volver a Shop Admin',
    workspaceStandard: 'Standard',
    workspacePm: 'PM',
    shopWorkspaces: 'Espacios del Shop',
    priority: { low: 'Baja', normal: 'Normal', high: 'Alta', critical: 'Crítica' },
    jobStatus: { to_do: 'Por hacer', completed: 'Completado', cancelled: 'Cancelado' },
    status: { created: 'Creado', in_progress: 'En progreso', waiting_paused: 'Pausado', completed: 'Completado', cancelled: 'Cancelado' },
    pauseReason: {
      [PauseReason.WAITING_FOR_PARTS]: 'En espera de piezas',
      [PauseReason.WAITING_FOR_APPROVAL]: 'En espera de aprobación',
      [PauseReason.WAITING_FOR_VENDOR]: 'En espera del proveedor',
      [PauseReason.WAITING_FOR_EQUIPMENT]: 'En espera de equipo o herramienta',
      [PauseReason.WAITING_FOR_BAY]: 'En espera de bahía',
      [PauseReason.WAITING_FOR_DRIVER]: 'En espera del conductor',
      [PauseReason.TRUCK_UNAVAILABLE]: 'Truck no disponible',
      [PauseReason.WORKING_ON_ANOTHER_WO]: 'Trabajando en otro Work Order',
      [PauseReason.BREAK]: 'Descanso',
      [PauseReason.END_OF_SHIFT]: 'Fin del turno',
      [PauseReason.OTHER]: 'Otro',
    },
  },
};

const LocaleContext = React.createContext<{ messages: Copy; setLocale: (locale: ShopLocale) => void } | null>(null);

export function ShopLocaleProvider({
  children,
  initialLocale = 'en',
}: {
  children: React.ReactNode;
  initialLocale?: ShopLocale;
}) {
  const locale = React.useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('ltl-shop-locale-change', onStoreChange);
      return () => window.removeEventListener('ltl-shop-locale-change', onStoreChange);
    },
    () => shopLocaleFromCookieHeader(document.cookie),
    () => parseShopLocale(initialLocale),
  );
  const setLocale = React.useCallback((nextLocale: ShopLocale) => {
    document.cookie = shopLocaleCookieWrite(nextLocale);
    document.documentElement.lang = nextLocale;
    window.dispatchEvent(shopLocaleChangeEvent());
  }, []);

  React.useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = React.useMemo(() => ({ messages: copy[locale], setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useShopLocale() {
  const context = React.useContext(LocaleContext);
  if (!context) throw new Error('useShopLocale must be used within ShopLocaleProvider');
  return context;
}

export function getShopCopy(locale: ShopLocale): Copy { return copy[locale]; }
