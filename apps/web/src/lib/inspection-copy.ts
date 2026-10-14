/**
 * D41: the inspection sheet's words, in English and Spanish. It lives apart from the Admin catalog (server-only)
 * because the same sheet runs in the mechanic's workspace (HU-ME7). The type keeps both languages complete.
 */
export type InspectionLocale = 'en' | 'es';

export type InspectionCopy = {
  crumbTrucks: string;
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
  minTread: (steer: number, drive: number) => string;
  tireOf: (index: number) => string;
  lastCheck: (date: string, psi: number, tread: number) => string;
  noPreviousReading: string;
  pressureTarget: (target: number) => string;
  treadMin: (min: number) => string;
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
  tiresOk: (ok: number) => string;
  noTireReadings: string;
  sinceLast: (psi: number, date: string) => string;
  checkedBy: (date: string, name: string, previous: string | null) => string;
  earlierVisit: (date: string) => string;
  inspectedBy: (name: string, role: string, when: string) => string;
  checksAndTires: (checks: number) => string;
  tiresFlagged: (count: number) => string;
  addedLaterCount: (count: number) => string;
};

const en: InspectionCopy = {
  crumbTrucks: 'Trucks',
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
  minTread: (steer, drive) => `Min tread: steer ${steer}/32 · drive ${drive}/32`,
  tireOf: (index) => `Tire ${index} of 10`,
  lastCheck: (date, psi, tread) => `Last check ${date}: ${psi} PSI · ${tread}/32`,
  noPreviousReading: 'No earlier reading',
  pressureTarget: (target) => `Pressure · target ${target}`,
  treadMin: (min) => `Tread · min ${min}/32`,
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
  tiresOk: (ok) => `${ok}/10 OK`,
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
  meta: (mileage, name, role) => `${mileage} · ${name} (${role}) · se guarda en este teléfono mientras avanzas`,
  roleManager: 'Manager',
  roleMechanic: 'Mecánico',
  savedOnDevice: 'Se guarda en este teléfono mientras avanzas',
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
  minTread: (steer, drive) => `Tread mínimo: dirección ${steer}/32 · tracción ${drive}/32`,
  tireOf: (index) => `Llanta ${index} de 10`,
  lastCheck: (date, psi, tread) => `Última revisión ${date}: ${psi} PSI · ${tread}/32`,
  noPreviousReading: 'Sin lectura anterior',
  pressureTarget: (target) => `Presión · objetivo ${target}`,
  treadMin: (min) => `Tread · mínimo ${min}/32`,
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
  tiresOk: (ok) => `${ok}/10 OK`,
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
