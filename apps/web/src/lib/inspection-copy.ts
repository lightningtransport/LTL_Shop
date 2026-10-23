import type { TreadBand } from '@ltl-shop/shared';

/**
 * D41: the inspection sheet's words, in English and Spanish. It lives apart from the Admin catalog (server-only)
 * because the same sheet runs in the mechanic's workspace (HU-ME7). The type keeps both languages complete.
 */
export type InspectionLocale = 'en' | 'es';

export type InspectionCopy = {
  crumbTrucks: string;
  setupTitle: string;
  setupIntro: string;
  addCheck: string;
  addCheckTitle: (section: string) => string;
  addCheckSub: (section: string) => string;
  checkName: string;
  checkNamePlaceholder: string;
  defectCreates: string;
  /** LTR-293 §3: the check dialog says what is missing on Save. */
  pcFieldRequired: string;
  pcMissingTitle: string;
  detailingOption: string;
  noteOnDetailing: string;
  rename: string;
  renameTitle: string;
  changeJob: string;
  changeJobTitle: (label: string) => string;
  moveUp: string;
  moveDown: string;
  deactivate: string;
  activate: string;
  inactiveBadge: string;
  newBadge: string;
  moreFor: (label: string) => string;
  unsaved: string;
  discard: string;
  saveChanges: string;
  checklistSaved: string;
  checklistSaveFailed: string;
  tiresLimitsTitle: string;
  tiresLimitsHint: string;
  steerPsi: string;
  drivePsi: string;
  steerMinTread: string;
  driveMinTread: string;
  watchPct: string;
  fixPct: string;
  ruleOk: string;
  ruleWatch: string;
  ruleFix: string;
  treadWatchMargin: string;
  /** D57: one axle's tread numbers in Setup and under the sheet's diagram. */
  treadLine: (axle: string, band: TreadBand) => string;
  driveAxle: string;
  whoCanInspectTitle: string;
  whoCanInspectText: string;
  openPeople: string;
  readOnlyChecklist: string;
  inactiveJobWarning: (count: number) => string;
  applyNote: string;
  toInspectTitle: string;
  inspectedByYou: (date: string) => string;
  legacyTitle: (issues: boolean) => string;
  legacySub: (when: string, name: string) => string;
  toInspectHint: string;
  start: string;
  waitingSince: (date: string) => string;
  myWork: string;
  savedForManager: (jobs: number) => string;
  crumbInspection: string;
  sectionInterior: string;
  sectionEngine: string;
  sectionExterior: string;
  sectionTires: string;
  sectionNotes: string;
  ok: string;
  defect: string;
  na: string;
  tapAgainToClear: string;
  markRestOk: string;
  sectionDone: string;
  defectsCount: (count: number) => string;
  whatsWrong: string;
  whatsWrongPlaceholder: string;
  createsJob: (job: string, category: string) => string;
  goesToDetailing: string;
  title: (truck: string) => string;
  meta: (mileage: string, name: string, role: string) => string;
  roleManager: string;
  roleMechanic: string;
  savedOnDevice: string;
  defectsSoFar: (count: number) => string;
  tiresDiagram: string;
  tiresTable: string;
  front: string;
  steer: string;
  drive1: string;
  drive2: string;
  tapTire: string;
  legendOk: string;
  legendWatch: string;
  legendFix: string;
  targets: (steer: number, drive: number) => string;
  tireOf: (index: number) => string;
  lastCheck: (date: string, psi: number, tread: number) => string;
  noPreviousReading: string;
  pressureTarget: (target: number) => string;
  treadMin: (band: TreadBand) => string;
  less: string;
  more: string;
  done: string;
  nextTire: string;
  previousTire: string;
  close: string;
  statusOk: string;
  statusWatch: string;
  statusFix: string;
  tireColumn: string;
  lastColumn: string;
  notesPlaceholder: string;
  notesHint: string;
  checksLeft: (count: number) => string;
  tiresLeft: (count: number) => string;
  defectsWithoutNote: (count: number) => string;
  allChecked: string;
  review: string;
  back: string;
  reviewTitle: (truck: string) => string;
  reportTitle: (truck: string) => string;
  result: string;
  issuesFound: (jobs: number, notes: number) => string;
  noIssuesFound: string;
  issuesSubManager: string;
  issuesSubMechanic: string;
  issuesSubSaved: string;
  noIssuesSub: (watch: number) => string;
  jobsToCreate: string;
  jobsCreated: string;
  defectsInOneJob: (count: number) => string;
  addsToExisting: (job: string) => string;
  newJob: string;
  assignLater: string;
  managerAssigns: string;
  alignmentQueue: string;
  goesToAlignment: (name: string | null) => string;
  unassigned: string;
  notesOnSteps: string;
  noNewJob: string;
  toWatch: string;
  watchHint: string;
  checklist: string;
  checklistLine: (ok: number, na: number, defects: number) => string;
  signature: string;
  iInspected: (truck: string) => string;
  iFound: (truck: string) => string;
  signedAs: (name: string, role: string) => string;
  signedBy: (name: string, when: string) => string;
  signToSave: string;
  jobsGoTo: (wo: string) => string;
  jobsGoToManager: string;
  saveCreate: (count: number) => string;
  saveNoIssues: string;
  saveNotes: string;
  saving: string;
  saved: (jobs: number, wo: string) => string;
  savedNoIssues: string;
  saveFailed: string;
  readOnlyHint: string;
  addDefects: string;
  addDefectsTitle: (truck: string) => string;
  addOnlyTitle: string;
  addOnlySub: string;
  savedDefect: string;
  tiresAsRecorded: (time: string) => string;
  markNewDefect: string;
  newDefects: (count: number) => string;
  cancel: string;
  reviewAdded: (truck: string) => string;
  addedLater: (name: string, when: string) => string;
  defectsAdded: (count: number, jobs: number) => string;
  loading: string;
  loadFailed: string;
  retry: string;
  needsWorkOrder: string;
  notAllowed: string;
  viewReport: string;
  startInspection: string;
  noOneAssigned: string;
  tiresCard: string;
  installedTitle: string;
  installedLine: (type: 'new' | 'recap', size: string | null, date: string, wo: string) => string;
  tiresOk: (ok: number, total: number) => string;
  /** AP-4 / D57: the groups under the tire diagram and why a tire is in the first one. */
  tiresGroupJob: string;
  tiresGroupWatch: string;
  tireReason: (tire: { psi: number; tread: number; targetPsi: number; minTread: number; reason: 'low_pressure' | 'high_pressure' | 'worn' }) => string;
  noTireReadings: string;
  sinceLast: (psi: number, date: string) => string;
  checkedBy: (date: string, name: string, previous: string | null) => string;
  earlierVisit: (date: string) => string;
  inspectedBy: (name: string, role: string, when: string) => string;
  checksAndTires: (checks: number) => string;
  tiresFlagged: (count: number) => string;
  addedLaterCount: (count: number) => string;
};

/** D57: "Job at 4/32 or less · Watch 5–6/32 · OK from 7/32"; no Watch part when the margin is 0. */
function treadBandEn(band: TreadBand) {
  const watch = band.watchTo < band.watchFrom ? null : band.watchTo === band.watchFrom ? `Watch ${band.watchFrom}/32` : `Watch ${band.watchFrom}–${band.watchTo}/32`;
  return [`Job at ${band.jobAtOrBelow}/32 or less`, watch, `OK from ${band.okFrom}/32`].filter(Boolean).join(' · ');
}

function treadBandEs(band: TreadBand) {
  const watch = band.watchTo < band.watchFrom ? null : band.watchTo === band.watchFrom ? `Vigilar ${band.watchFrom}/32` : `Vigilar ${band.watchFrom}–${band.watchTo}/32`;
  return [`Job con ${band.jobAtOrBelow}/32 o menos`, watch, `OK desde ${band.okFrom}/32`].filter(Boolean).join(' · ');
}

const en: InspectionCopy = {
  crumbTrucks: 'Trucks',
  setupTitle: 'Inspection checklist',
  setupIntro: 'What every truck inspection checks.',
  addCheck: 'Add check',
  addCheckTitle: (section) => `Add check · ${section}`,
  addCheckSub: (section) => `It shows on new inspections at the end of ${section}.`,
  checkName: 'Check',
  checkNamePlaceholder: 'e.g. Mud flaps',
  defectCreates: 'A defect creates',
  pcFieldRequired: 'Required',
  pcMissingTitle: 'Complete these to save:',
  detailingOption: 'A note on the Detailing step',
  noteOnDetailing: 'Note on the Detailing step',
  rename: 'Rename',
  renameTitle: 'Rename check',
  changeJob: 'Change Job',
  changeJobTitle: (label) => `What a defect in “${label}” creates`,
  moveUp: 'Move up',
  moveDown: 'Move down',
  deactivate: 'Deactivate',
  activate: 'Activate',
  inactiveBadge: 'Inactive',
  newBadge: 'New',
  moreFor: (label) => `More for ${label}`,
  unsaved: 'Unsaved changes',
  discard: 'Discard',
  saveChanges: 'Save',
  checklistSaved: 'Checklist saved · applies to new inspections',
  checklistSaveFailed: 'The checklist was not saved.',
  tiresLimitsTitle: 'Tires',
  tiresLimitsHint: '10 tires: steer and 2 drive axles.',
  steerPsi: 'Steer PSI',
  drivePsi: 'Drive PSI',
  steerMinTread: 'Steer min tread /32',
  driveMinTread: 'Drive min tread /32',
  watchPct: 'Watch past ±%',
  fixPct: 'Fix past ±%',
  ruleOk: 'OK: within the watch range and tread past the watch margin',
  ruleWatch: 'Watch: past the watch range or tread within the margin above the minimum',
  ruleFix: 'Fix: past the fix range or tread at the minimum or under',
  treadWatchMargin: 'Watch margin above min tread /32',
  treadLine: (axle, band) => `${axle} tread: ${treadBandEn(band)}`,
  driveAxle: 'Drive',
  whoCanInspectTitle: 'Who can inspect',
  whoCanInspectText: 'Managers always. Mechanics only with “Can inspect trucks” in People.',
  openPeople: 'Open People',
  readOnlyChecklist: 'Only the Shop Manager or a System Admin can change the checklist.',
  inactiveJobWarning: (count) => `${count} active check${count === 1 ? '' : 's'} point${count === 1 ? 's' : ''} to a Job that is no longer active. Change ${count === 1 ? 'its' : 'their'} Job.`,
  applyNote: 'Deactivate a check to stop using it.',
  toInspectTitle: 'To inspect',
  inspectedByYou: (date) => `Inspected by you · ${date}`,
  legacyTitle: (issues) => `Recorded before the inspection sheet: ${issues ? 'Issues found' : 'No issues found'}`,
  legacySub: (when, name) => `${[name, when].filter(Boolean).join(' · ')}. There is no sheet for this visit; fill it now to keep the checks and the tire readings.`,
  toInspectHint: 'Trucks waiting for inspection, and the ones you inspected while their Work Order is open. You see them because you can inspect trucks.',
  start: 'Start',
  waitingSince: (date) => `Waiting since ${date}`,
  myWork: 'My work',
  savedForManager: (jobs) => (jobs ? `Inspection saved · ${jobs} Job${jobs === 1 ? '' : 's'} for the Manager to assign` : 'Inspection saved · No issues found'),
  crumbInspection: 'Inspection',
  sectionInterior: 'Interior',
  sectionEngine: 'Engine & fluids',
  sectionExterior: 'Exterior',
  sectionTires: 'Tires',
  sectionNotes: 'Notes',
  ok: 'OK',
  defect: 'Defect',
  na: 'N/A',
  tapAgainToClear: 'tap again to clear',
  markRestOk: 'Mark rest OK',
  sectionDone: 'Done',
  defectsCount: (count) => `${count} defect${count === 1 ? '' : 's'}`,
  whatsWrong: 'What’s wrong?',
  whatsWrongPlaceholder: 'Where it is and what you see',
  createsJob: (job, category) => `Creates the Job ${job} · ${category}`,
  goesToDetailing: 'Goes as a note on the Detailing step (already on the Work Order).',
  title: (truck) => `Inspection · Truck ${truck}`,
  meta: (mileage, name, role) => `${mileage} · ${name} (${role}) · saved on this device as you go`,
  roleManager: 'Manager',
  roleMechanic: 'Mechanic',
  savedOnDevice: 'Saved on this device as you go',
  defectsSoFar: (count) => `${count} defect${count === 1 ? '' : 's'} so far`,
  tiresDiagram: 'Diagram',
  tiresTable: 'Table',
  front: 'Front',
  steer: 'Steer',
  drive1: 'Drive 1',
  drive2: 'Drive 2',
  tapTire: 'Tap a tire to enter PSI and tread. “Next tire” goes around in order.',
  legendOk: 'OK',
  legendWatch: 'Watch (no Job)',
  legendFix: 'Fix (creates a Job)',
  targets: (steer, drive) => `Target: steer ${steer} PSI · drive ${drive} PSI`,
  tireOf: (index) => `Tire ${index} of 10`,
  lastCheck: (date, psi, tread) => `Last check ${date}: ${psi} PSI · ${tread}/32`,
  noPreviousReading: 'No earlier reading',
  pressureTarget: (target) => `Pressure · target ${target}`,
  treadMin: (band) => `Tread · ${treadBandEn(band)}`,
  less: 'Less',
  more: 'More',
  done: 'Done',
  nextTire: 'Next tire',
  previousTire: 'Previous tire',
  close: 'Close',
  statusOk: 'In range',
  statusWatch: 'Watch — shown on the Truck, no Job',
  statusFix: 'Fix — creates a Job',
  tireColumn: 'Tire',
  lastColumn: 'Last',
  notesPlaceholder: 'Anything else the next person should know',
  notesHint: 'Optional. Saved with the inspection.',
  checksLeft: (count) => `${count} check${count === 1 ? '' : 's'} left`,
  tiresLeft: (count) => `${count} tire${count === 1 ? '' : 's'} left`,
  defectsWithoutNote: (count) => `${count} defect${count === 1 ? '' : 's'} without a note`,
  allChecked: 'All checked',
  review: 'Review',
  back: 'Back',
  reviewTitle: (truck) => `Review inspection · Truck ${truck}`,
  reportTitle: (truck) => `Inspection report · Truck ${truck}`,
  result: 'Result',
  issuesFound: (jobs, notes) => `Issues found · ${jobs} Job${jobs === 1 ? '' : 's'}${notes ? ` + ${notes} note${notes === 1 ? '' : 's'} on steps` : ''}`,
  noIssuesFound: 'No issues found',
  issuesSubManager: 'The Jobs are created when you save. Pick who does each one now, or assign later.',
  issuesSubMechanic: 'The Jobs are created when you save. The Manager assigns them.',
  issuesSubSaved: 'Recorded on the Truck.',
  noIssuesSub: (watch) => `${watch ? `${watch} tire${watch === 1 ? '' : 's'} to watch, nothing to fix.` : 'Every check OK and all tires in range.'} The truck moves on to PM.`,
  jobsToCreate: 'Jobs to create',
  jobsCreated: 'Jobs from the inspection',
  defectsInOneJob: (count) => `${count} defects in one Job`,
  addsToExisting: (job) => `Adds to ${job} on the Work Order`,
  newJob: 'New Job',
  assignLater: 'Assign later',
  managerAssigns: 'Manager assigns',
  alignmentQueue: 'Alignment queue',
  goesToAlignment: (name) => (name ? `Goes to ${name} · Alignment` : 'Goes to the Alignment queue'),
  unassigned: 'Unassigned',
  notesOnSteps: 'Notes on steps already on the Work Order',
  noNewJob: 'no new Job',
  toWatch: 'To watch',
  watchHint: 'Shown on the Truck’s Tires card. No Job.',
  checklist: 'Checklist',
  checklistLine: (ok, na, defects) => `${ok} OK · ${na} N/A · ${defects} defect${defects === 1 ? '' : 's'}`,
  signature: 'Signature',
  iInspected: (truck) => `I inspected Truck ${truck}`,
  iFound: (truck) => `I found these on Truck ${truck}`,
  signedAs: (name, role) => `Signed as ${name} (${role})`,
  signedBy: (name, when) => `Signed by ${name} · ${when}`,
  signToSave: 'Check the signature box to save.',
  jobsGoTo: (wo) => `Jobs go to Shop Work on ${wo}.`,
  jobsGoToManager: 'Jobs go to the Manager unassigned.',
  saveCreate: (count) => `Save · create ${count} Job${count === 1 ? '' : 's'}`,
  saveNoIssues: 'Save · No issues found',
  saveNotes: 'Save · add notes',
  saving: 'Saving…',
  saved: (jobs, wo) => `Inspection saved · ${jobs} Job${jobs === 1 ? '' : 's'} on ${wo}`,
  savedNoIssues: 'Inspection saved · No issues found',
  saveFailed: 'The inspection was not saved.',
  readOnlyHint: 'What was saved stays as recorded. To undo a defect, cancel its Job in the Work Order.',
  addDefects: 'Add defects',
  addDefectsTitle: (truck) => `Add defects · Truck ${truck}`,
  addOnlyTitle: 'Mark what you found after saving',
  addOnlySub: 'Each new defect creates its Job, like before. What was saved can’t be changed here: to undo a defect, cancel its Job in the Work Order.',
  savedDefect: 'Saved defect',
  tiresAsRecorded: (time) => `Readings stay as recorded at ${time}. A tire problem found later: mark Tire condition as a defect.`,
  markNewDefect: 'Mark a new defect',
  newDefects: (count) => `${count} new defect${count === 1 ? '' : 's'}`,
  cancel: 'Cancel',
  reviewAdded: (truck) => `Review added defects · Truck ${truck}`,
  addedLater: (name, when) => `Added later · ${name} · ${when}`,
  defectsAdded: (count, jobs) => `${count} defect${count === 1 ? '' : 's'} added · ${jobs} new Job${jobs === 1 ? '' : 's'}`,
  loading: 'Loading inspection',
  loadFailed: 'The inspection could not be loaded.',
  retry: 'Try again',
  needsWorkOrder: 'Open a Work Order for this Truck before inspecting it.',
  notAllowed: 'You cannot inspect trucks. The Manager turns it on in People.',
  viewReport: 'View report',
  startInspection: 'Start inspection',
  noOneAssigned: 'Assign',
  tiresCard: 'Tires',
  installedTitle: 'Mounted',
  installedLine: (type, size, date, wo) => `${type === 'new' ? 'New' : 'Recap'}${size ? ` ${size}` : ''} · ${date} · ${wo}`,
  tiresOk: (ok, total) => `${ok}/${total} OK`,
  tiresGroupJob: 'Job',
  tiresGroupWatch: 'Watch',
  tireReason: ({ psi, tread, targetPsi, minTread, reason }) => (reason === 'worn'
    ? `${psi} PSI · ${tread}/32 (min ${minTread}) · worn`
    : `${psi} PSI (should be ${targetPsi}) · ${reason === 'low_pressure' ? 'low' : 'high'} pressure`),
  noTireReadings: 'No tire readings for this visit yet. They are recorded in the inspection.',
  sinceLast: (psi, date) => `${Math.abs(psi)} PSI since ${date}`,
  checkedBy: (date, name, previous) => `Checked ${date} by ${name}${previous ? ` · previous ${previous}` : ''}`,
  earlierVisit: (date) => `From an earlier visit · ${date}. This visit is not inspected yet.`,
  inspectedBy: (name, role, when) => `${name} (${role}) · ${when}`,
  checksAndTires: (checks) => `${checks} checks · 10 tires`,
  tiresFlagged: (count) => `${count} tire${count === 1 ? '' : 's'} to watch or fix`,
  addedLaterCount: (count) => `+${count} defect${count === 1 ? '' : 's'} added later`,
};

const es: InspectionCopy = {
  crumbTrucks: 'Camiones',
  setupTitle: 'Lista de inspección',
  setupIntro: 'Lo que revisa cada inspección de camión.',
  addCheck: 'Agregar punto',
  addCheckTitle: (section) => `Agregar punto · ${section}`,
  addCheckSub: (section) => `Sale en las inspecciones nuevas al final de ${section}.`,
  checkName: 'Punto',
  checkNamePlaceholder: 'p. ej. Loderas',
  defectCreates: 'Un defecto crea',
  pcFieldRequired: 'Obligatorio',
  pcMissingTitle: 'Completa esto para guardar:',
  detailingOption: 'Una nota en el paso Detailing',
  noteOnDetailing: 'Nota en el paso Detailing',
  rename: 'Renombrar',
  renameTitle: 'Renombrar punto',
  changeJob: 'Cambiar Job',
  changeJobTitle: (label) => `Qué crea un defecto en “${label}”`,
  moveUp: 'Subir',
  moveDown: 'Bajar',
  deactivate: 'Desactivar',
  activate: 'Activar',
  inactiveBadge: 'Inactivo',
  newBadge: 'Nuevo',
  moreFor: (label) => `Más opciones de ${label}`,
  unsaved: 'Cambios sin guardar',
  discard: 'Descartar',
  saveChanges: 'Guardar',
  checklistSaved: 'Lista guardada · vale para las inspecciones nuevas',
  checklistSaveFailed: 'La lista no se guardó.',
  tiresLimitsTitle: 'Llantas',
  tiresLimitsHint: '10 llantas: dirección y 2 ejes de tracción.',
  steerPsi: 'PSI dirección',
  drivePsi: 'PSI tracción',
  steerMinTread: 'Tread mínimo dirección /32',
  driveMinTread: 'Tread mínimo tracción /32',
  watchPct: 'Vigilar desde ±%',
  fixPct: 'Arreglar desde ±%',
  ruleOk: 'OK: dentro del rango y tread por encima del margen de vigilar',
  ruleWatch: 'Vigilar: fuera del rango de vigilar o tread dentro del margen sobre el mínimo',
  ruleFix: 'Arreglar: fuera del rango o tread en el mínimo o por debajo',
  treadWatchMargin: 'Margen vigilar sobre el tread mínimo /32',
  treadLine: (axle, band) => `Tread ${axle.toLowerCase()}: ${treadBandEs(band)}`,
  driveAxle: 'Tracción',
  whoCanInspectTitle: 'Quién inspecciona',
  whoCanInspectText: 'Los Managers siempre. Los mecánicos solo con “Puede inspeccionar camiones” en People.',
  openPeople: 'Abrir People',
  readOnlyChecklist: 'Solo el Shop Manager o un System Admin pueden cambiar la lista.',
  inactiveJobWarning: (count) => `${count} punto${count === 1 ? '' : 's'} activo${count === 1 ? '' : 's'} apunta${count === 1 ? '' : 'n'} a un Job que ya no está activo. Cambia su Job.`,
  applyNote: 'Desactiva un punto para dejar de usarlo.',
  toInspectTitle: 'Por inspeccionar',
  inspectedByYou: (date) => `Lo inspeccionaste tú · ${date}`,
  legacyTitle: (issues) => `Registrado antes de la hoja de inspección: ${issues ? 'Issues found' : 'No issues found'}`,
  legacySub: (when, name) => `${[name, when].filter(Boolean).join(' · ')}. Esta visita no tiene hoja; llénala ahora para guardar los puntos y las llantas.`,
  toInspectHint: 'Camiones que esperan inspección, y los que inspeccionaste mientras su Work Order siga abierta. Los ves porque puedes inspeccionar camiones.',
  start: 'Empezar',
  waitingSince: (date) => `Esperando desde ${date}`,
  myWork: 'Mi trabajo',
  savedForManager: (jobs) => (jobs ? `Inspección guardada · ${jobs} Job${jobs === 1 ? '' : 's'} para que los asigne el Manager` : 'Inspección guardada · No issues found'),
  crumbInspection: 'Inspección',
  sectionInterior: 'Interior',
  sectionEngine: 'Motor y fluidos',
  sectionExterior: 'Exterior',
  sectionTires: 'Llantas',
  sectionNotes: 'Notas',
  ok: 'OK',
  defect: 'Defecto',
  na: 'N/A',
  tapAgainToClear: 'toca otra vez para borrar',
  markRestOk: 'Lo demás OK',
  sectionDone: 'Listo',
  defectsCount: (count) => `${count} defecto${count === 1 ? '' : 's'}`,
  whatsWrong: '¿Qué tiene?',
  whatsWrongPlaceholder: 'Dónde está y qué ves',
  createsJob: (job, category) => `Crea el Job ${job} · ${category}`,
  goesToDetailing: 'Va como nota al paso Detailing (ya está en la Work Order).',
  title: (truck) => `Inspección · Camión ${truck}`,
  meta: (mileage, name, role) => `${mileage} · ${name} (${role}) · se guarda en este dispositivo mientras avanzas`,
  roleManager: 'Manager',
  roleMechanic: 'Mecánico',
  savedOnDevice: 'Se guarda en este dispositivo mientras avanzas',
  defectsSoFar: (count) => `${count} defecto${count === 1 ? '' : 's'} hasta ahora`,
  tiresDiagram: 'Diagrama',
  tiresTable: 'Tabla',
  front: 'Frente',
  steer: 'Dirección',
  drive1: 'Tracción 1',
  drive2: 'Tracción 2',
  tapTire: 'Toca una llanta para anotar PSI y tread. “Siguiente llanta” da la vuelta en orden.',
  legendOk: 'OK',
  legendWatch: 'Vigilar (sin Job)',
  legendFix: 'Arreglar (crea un Job)',
  targets: (steer, drive) => `Objetivo: dirección ${steer} PSI · tracción ${drive} PSI`,
  tireOf: (index) => `Llanta ${index} de 10`,
  lastCheck: (date, psi, tread) => `Última revisión ${date}: ${psi} PSI · ${tread}/32`,
  noPreviousReading: 'Sin lectura anterior',
  pressureTarget: (target) => `Presión · objetivo ${target}`,
  treadMin: (band) => `Tread · ${treadBandEs(band)}`,
  less: 'Menos',
  more: 'Más',
  done: 'Listo',
  nextTire: 'Siguiente llanta',
  previousTire: 'Llanta anterior',
  close: 'Cerrar',
  statusOk: 'En rango',
  statusWatch: 'Vigilar — se ve en el camión, sin Job',
  statusFix: 'Arreglar — crea un Job',
  tireColumn: 'Llanta',
  lastColumn: 'Anterior',
  notesPlaceholder: 'Lo que deba saber la próxima persona',
  notesHint: 'Opcional. Se guarda con la inspección.',
  checksLeft: (count) => `Faltan ${count} punto${count === 1 ? '' : 's'}`,
  tiresLeft: (count) => `Faltan ${count} llanta${count === 1 ? '' : 's'}`,
  defectsWithoutNote: (count) => `${count} defecto${count === 1 ? '' : 's'} sin nota`,
  allChecked: 'Todo revisado',
  review: 'Revisar',
  back: 'Atrás',
  reviewTitle: (truck) => `Revisar inspección · Camión ${truck}`,
  reportTitle: (truck) => `Reporte de inspección · Camión ${truck}`,
  result: 'Resultado',
  issuesFound: (jobs, notes) => `Issues found · ${jobs} Job${jobs === 1 ? '' : 's'}${notes ? ` + ${notes} nota${notes === 1 ? '' : 's'} en pasos` : ''}`,
  noIssuesFound: 'No issues found',
  issuesSubManager: 'Los Jobs se crean al guardar. Elige ahora quién hace cada uno, o asígnalos después.',
  issuesSubMechanic: 'Los Jobs se crean al guardar. El Manager los asigna.',
  issuesSubSaved: 'Registrado en el camión.',
  noIssuesSub: (watch) => `${watch ? `${watch} llanta${watch === 1 ? '' : 's'} para vigilar, nada que arreglar.` : 'Todo OK y las llantas en rango.'} El camión sigue a PM.`,
  jobsToCreate: 'Jobs que se crean',
  jobsCreated: 'Jobs de la inspección',
  defectsInOneJob: (count) => `${count} defectos en un Job`,
  addsToExisting: (job) => `Se suma a ${job} en la Work Order`,
  newJob: 'Job nuevo',
  assignLater: 'Asignar después',
  managerAssigns: 'Lo asigna el Manager',
  alignmentQueue: 'Cola de Alignment',
  goesToAlignment: (name) => (name ? `Va a ${name} · Alignment` : 'Va a la cola de Alignment'),
  unassigned: 'Sin asignar',
  notesOnSteps: 'Notas a pasos que ya están en la Work Order',
  noNewJob: 'sin Job nuevo',
  toWatch: 'Para vigilar',
  watchHint: 'Se ve en la tarjeta Llantas del camión. Sin Job.',
  checklist: 'Lista',
  checklistLine: (ok, na, defects) => `${ok} OK · ${na} N/A · ${defects} defecto${defects === 1 ? '' : 's'}`,
  signature: 'Firma',
  iInspected: (truck) => `Inspeccioné el camión ${truck}`,
  iFound: (truck) => `Encontré esto en el camión ${truck}`,
  signedAs: (name, role) => `Firma de ${name} (${role})`,
  signedBy: (name, when) => `Firmó ${name} · ${when}`,
  signToSave: 'Marca la firma para guardar.',
  jobsGoTo: (wo) => `Los Jobs van a Shop Work de ${wo}.`,
  jobsGoToManager: 'Los Jobs le llegan al Manager sin asignar.',
  saveCreate: (count) => `Guardar · crear ${count} Job${count === 1 ? '' : 's'}`,
  saveNoIssues: 'Guardar · No issues found',
  saveNotes: 'Guardar · sumar notas',
  saving: 'Guardando…',
  saved: (jobs, wo) => `Inspección guardada · ${jobs} Job${jobs === 1 ? '' : 's'} en ${wo}`,
  savedNoIssues: 'Inspección guardada · No issues found',
  saveFailed: 'La inspección no se guardó.',
  readOnlyHint: 'Lo guardado queda como se registró. Para deshacer un defecto, cancela su Job en la Work Order.',
  addDefects: 'Agregar defectos',
  addDefectsTitle: (truck) => `Agregar defectos · Camión ${truck}`,
  addOnlyTitle: 'Marca lo que encontraste después de guardar',
  addOnlySub: 'Cada defecto nuevo crea su Job, como antes. Lo guardado no se cambia aquí: para deshacer un defecto, cancela su Job en la Work Order.',
  savedDefect: 'Defecto guardado',
  tiresAsRecorded: (time) => `Las lecturas quedan como se anotaron a las ${time}. Si encuentras un problema de llanta, marca Tire condition como defecto.`,
  markNewDefect: 'Marca un defecto nuevo',
  newDefects: (count) => `${count} defecto${count === 1 ? '' : 's'} nuevo${count === 1 ? '' : 's'}`,
  cancel: 'Cancelar',
  reviewAdded: (truck) => `Revisar defectos agregados · Camión ${truck}`,
  addedLater: (name, when) => `Agregado después · ${name} · ${when}`,
  defectsAdded: (count, jobs) => `${count} defecto${count === 1 ? '' : 's'} agregado${count === 1 ? '' : 's'} · ${jobs} Job${jobs === 1 ? '' : 's'} nuevo${jobs === 1 ? '' : 's'}`,
  loading: 'Cargando inspección',
  loadFailed: 'No se pudo cargar la inspección.',
  retry: 'Reintentar',
  needsWorkOrder: 'Abre una Work Order para este camión antes de inspeccionarlo.',
  notAllowed: 'No puedes inspeccionar camiones. El Manager lo enciende en People.',
  viewReport: 'Ver reporte',
  startInspection: 'Empezar inspección',
  noOneAssigned: 'Asignar',
  tiresCard: 'Llantas',
  installedTitle: 'Montadas',
  installedLine: (type, size, date, wo) => `${type === 'new' ? 'Nueva' : 'Recap'}${size ? ` ${size}` : ''} · ${date} · ${wo}`,
  tiresOk: (ok, total) => `${ok}/${total} OK`,
  tiresGroupJob: 'Job',
  tiresGroupWatch: 'Vigilar',
  tireReason: ({ psi, tread, targetPsi, minTread, reason }) => (reason === 'worn'
    ? `${psi} PSI · ${tread}/32 (mín. ${minTread}) · gastada`
    : `${psi} PSI (debe ser ${targetPsi}) · presión ${reason === 'low_pressure' ? 'baja' : 'alta'}`),
  noTireReadings: 'Todavía no hay lecturas de llantas en esta visita. Se anotan en la inspección.',
  sinceLast: (psi, date) => `${Math.abs(psi)} PSI desde ${date}`,
  checkedBy: (date, name, previous) => `Revisadas ${date} por ${name}${previous ? ` · anterior ${previous}` : ''}`,
  earlierVisit: (date) => `De una visita anterior · ${date}. Esta visita aún no se inspecciona.`,
  inspectedBy: (name, role, when) => `${name} (${role}) · ${when}`,
  checksAndTires: (checks) => `${checks} puntos · 10 llantas`,
  tiresFlagged: (count) => `${count} llanta${count === 1 ? '' : 's'} para vigilar o arreglar`,
  addedLaterCount: (count) => `+${count} defecto${count === 1 ? '' : 's'} agregado${count === 1 ? '' : 's'} después`,
};

export function inspectionCopy(locale: InspectionLocale | string | null | undefined): InspectionCopy {
  return locale === 'es' ? es : en;
}
