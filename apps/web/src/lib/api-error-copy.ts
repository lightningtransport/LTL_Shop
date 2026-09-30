import type { ShopLocale } from './shop-locale';

/**
 * LTR-181: every `code` the API throws (grep `code: '` in apps/api/src), plus the two transport
 * failures, with one short sentence per language. Both UI catalogs expose this object as
 * `apiError`, so `apiErrorMessage()` (api-error-message.ts) reads it from either one.
 * Keys with a shared audience avoid the Truck/unidad noun; the QC keys are Safety copy (unidad).
 */
export type ApiErrorCode =
  | 'ACTIVE_READINESS_ASSESSMENT_EXISTS'
  | 'BLOCKER_ALREADY_ACTIVE'
  | 'BLOCKER_ALREADY_RESOLVED'
  | 'BLOCKER_NOT_YOURS'
  | 'BLOCKER_REASON_NOT_ALLOWED'
  | 'CATALOG_ALIAS_EXISTS'
  | 'CATALOG_JOB_EXISTS'
  | 'DUPLICATE_STEP'
  | 'IDEMPOTENCY_KEY_REUSE'
  | 'JOB_BLOCKED'
  | 'JOB_NOT_ASSIGNED_TO_YOU'
  | 'JOB_NOT_PENDING'
  | 'LABOR_ALREADY_RUNNING'
  | 'MECHANIC_EMAIL_EXISTS'
  | 'MILEAGE_BELOW_CURRENT'
  | 'MILEAGE_JUMP_CONFIRMATION_REQUIRED'
  | 'NO_PENDING_JOBS'
  | 'OPEN_WORK_ORDER_EXISTS'
  | 'OWNER_NOT_ELIGIBLE'
  | 'PM_ALREADY_IN_PROGRESS'
  | 'PM_JOB_ALREADY_STARTED'
  | 'PM_JOB_DONE'
  | 'PM_JOB_EXISTS'
  | 'PM_JOB_NOT_STARTED'
  | 'PM_JOB_USES_PM_SERVICE'
  | 'QC_NOTE_REQUIRED'
  | 'QC_NOT_PENDING'
  | 'QC_NOT_READY'
  | 'QC_NOT_TAKEN'
  | 'QC_OWNER_MUST_BE_SAFETY'
  | 'QC_RETURNED'
  | 'QC_TAKEN'
  | 'RESUME_REQUIRED'
  | 'START_REQUIRED'
  | 'STEP_HAS_NO_OWNER'
  | 'UNKNOWN_STEP'
  | 'VERSION_CONFLICT'
  | 'WORK_ORDER_CLOSED'
  | 'WORK_ORDER_NOT_WORKABLE'
  | 'WORK_ORDER_PAUSED'
  | 'WORK_ORDER_VERSION_REQUIRED'
  | 'WORK_REQUEST_ALREADY_HANDLED'
  | 'WO_CLOSED';

export type ApiErrorCopy = Record<ApiErrorCode | 'network' | 'timeout', string>;

export const API_ERROR_COPY: Record<ShopLocale, ApiErrorCopy> = {
  en: {
    network: 'Unable to reach the Shop. Please try again.',
    timeout: 'The request took too long. Please try again.',
    ACTIVE_READINESS_ASSESSMENT_EXISTS: 'This Truck already has an active readiness assessment.',
    BLOCKER_ALREADY_ACTIVE: 'This Job already has an active blocker.',
    BLOCKER_ALREADY_RESOLVED: 'This blocker was already resolved.',
    BLOCKER_NOT_YOURS: 'Only the mechanic who reported this blocker can add to it.',
    BLOCKER_REASON_NOT_ALLOWED: 'That blocker reason is not available here.',
    CATALOG_ALIAS_EXISTS: 'That alias is already used by another catalog Job.',
    CATALOG_JOB_EXISTS: 'That Job name is already in the Job Catalog.',
    DUPLICATE_STEP: 'This Work Order already has that step.',
    IDEMPOTENCY_KEY_REUSE: 'This request was already sent. Reload to see the result.',
    JOB_BLOCKED: 'This Job has an active blocker. The Manager resolves it first.',
    JOB_NOT_ASSIGNED_TO_YOU: 'This Job is not assigned to you.',
    JOB_NOT_PENDING: 'This Job is no longer pending.',
    LABOR_ALREADY_RUNNING: 'Your labor time is already running.',
    MECHANIC_EMAIL_EXISTS: 'That email already belongs to an active Shop user.',
    MILEAGE_BELOW_CURRENT: 'Observed mileage cannot be lower than the current mileage. Check the odometer.',
    MILEAGE_JUMP_CONFIRMATION_REQUIRED: 'The mileage is far above the current reading. Confirm the odometer reading.',
    NO_PENDING_JOBS: 'This Work Order has no pending Jobs.',
    OPEN_WORK_ORDER_EXISTS: 'There is already an open Work Order for this Truck.',
    OWNER_NOT_ELIGIBLE: 'That person cannot own this step.',
    PM_ALREADY_IN_PROGRESS: 'Finish your PM service in progress before starting another.',
    PM_JOB_ALREADY_STARTED: 'This PM service was already started.',
    PM_JOB_DONE: 'This PM service is already done.',
    PM_JOB_EXISTS: 'This Work Order already has a PM Job.',
    PM_JOB_NOT_STARTED: 'Start the PM service first.',
    PM_JOB_USES_PM_SERVICE: 'The PM Job is completed from the PM service, not from the Job list.',
    QC_NOTE_REQUIRED: 'Say what you found first.',
    QC_NOT_PENDING: 'This Quality Check is no longer pending.',
    QC_NOT_READY: 'This truck is not ready for Quality Check yet.',
    QC_NOT_TAKEN: 'Take the truck before approving or returning it.',
    QC_OWNER_MUST_BE_SAFETY: 'Quality Check is done by Safety.',
    QC_RETURNED: 'This truck was returned to the Manager.',
    QC_TAKEN: 'Another Safety reviewer already took this truck.',
    RESUME_REQUIRED: 'Press Continue before completing Jobs.',
    START_REQUIRED: 'Press Start Work before completing Jobs.',
    STEP_HAS_NO_OWNER: 'This step has no owner yet. Assign it first.',
    UNKNOWN_STEP: 'That step is not part of the Shop workflow.',
    VERSION_CONFLICT: 'This Work Order changed in another session. Reload before trying again.',
    WORK_ORDER_CLOSED: 'This Work Order is closed.',
    WORK_ORDER_NOT_WORKABLE: 'This Work Order cannot be worked right now.',
    WORK_ORDER_PAUSED: 'This Work Order is paused. The Manager resumes it.',
    WORK_ORDER_VERSION_REQUIRED: 'Reload the Work Order before making this change.',
    WORK_REQUEST_ALREADY_HANDLED: 'This work request was already handled.',
    WO_CLOSED: 'This Work Order is closed.',
  },
  es: {
    network: 'No se pudo conectar con el Shop. Inténtalo de nuevo.',
    timeout: 'La solicitud tardó demasiado. Inténtalo de nuevo.',
    ACTIVE_READINESS_ASSESSMENT_EXISTS: 'Este Truck ya tiene una evaluación de preparación activa.',
    BLOCKER_ALREADY_ACTIVE: 'Este Job ya tiene un bloqueo activo.',
    BLOCKER_ALREADY_RESOLVED: 'Este bloqueo ya fue resuelto.',
    BLOCKER_NOT_YOURS: 'Solo el mecánico que reportó este bloqueo puede agregarle notas.',
    BLOCKER_REASON_NOT_ALLOWED: 'Ese motivo de bloqueo no está disponible aquí.',
    CATALOG_ALIAS_EXISTS: 'Ese alias ya lo usa otro Job del catálogo.',
    CATALOG_JOB_EXISTS: 'Ese nombre de Job ya está en el Job Catalog.',
    DUPLICATE_STEP: 'Este Work Order ya tiene ese paso.',
    IDEMPOTENCY_KEY_REUSE: 'Esta solicitud ya se envió. Recarga para ver el resultado.',
    JOB_BLOCKED: 'Este Job tiene un bloqueo activo. El Manager lo resuelve primero.',
    JOB_NOT_ASSIGNED_TO_YOU: 'Este Job no está asignado a ti.',
    JOB_NOT_PENDING: 'Este Job ya no está pendiente.',
    LABOR_ALREADY_RUNNING: 'Tu tiempo de labor ya está corriendo.',
    MECHANIC_EMAIL_EXISTS: 'Ese email ya pertenece a un usuario activo del Shop.',
    MILEAGE_BELOW_CURRENT: 'El millaje observado no puede ser menor que el millaje actual. Revisa el odómetro.',
    MILEAGE_JUMP_CONFIRMATION_REQUIRED: 'El millaje está muy por encima del actual. Confirma la lectura del odómetro.',
    NO_PENDING_JOBS: 'Este Work Order no tiene Jobs pendientes.',
    OPEN_WORK_ORDER_EXISTS: 'Ya hay un Work Order abierto para este Truck.',
    OWNER_NOT_ELIGIBLE: 'Esa persona no puede ser responsable de este paso.',
    PM_ALREADY_IN_PROGRESS: 'Termina tu servicio de PM en curso antes de iniciar otro.',
    PM_JOB_ALREADY_STARTED: 'Este servicio de PM ya fue iniciado.',
    PM_JOB_DONE: 'Este servicio de PM ya está terminado.',
    PM_JOB_EXISTS: 'Este Work Order ya tiene un Job de PM.',
    PM_JOB_NOT_STARTED: 'Primero inicia el servicio de PM.',
    PM_JOB_USES_PM_SERVICE: 'El Job de PM se completa desde el servicio de PM, no desde la lista de Jobs.',
    QC_NOTE_REQUIRED: 'Primero escribe qué encontraste.',
    QC_NOT_PENDING: 'Este Quality Check ya no está pendiente.',
    QC_NOT_READY: 'Esta unidad todavía no está lista para Quality Check.',
    QC_NOT_TAKEN: 'Toma la unidad antes de aprobarla o devolverla.',
    QC_OWNER_MUST_BE_SAFETY: 'El Quality Check lo hace Safety.',
    QC_RETURNED: 'Esta unidad fue devuelta al Manager.',
    QC_TAKEN: 'Otro revisor de Safety ya tomó esta unidad.',
    RESUME_REQUIRED: 'Pulsa Continuar antes de completar Jobs.',
    START_REQUIRED: 'Pulsa Iniciar trabajo antes de completar Jobs.',
    STEP_HAS_NO_OWNER: 'Este paso aún no tiene responsable. Asígnalo primero.',
    UNKNOWN_STEP: 'Ese paso no es parte del flujo del Shop.',
    VERSION_CONFLICT: 'Este Work Order cambió en otra sesión. Recarga antes de intentarlo de nuevo.',
    WORK_ORDER_CLOSED: 'Este Work Order está cerrado.',
    WORK_ORDER_NOT_WORKABLE: 'Este Work Order no se puede trabajar ahora.',
    WORK_ORDER_PAUSED: 'Este Work Order está pausado. El Manager lo reanuda.',
    WORK_ORDER_VERSION_REQUIRED: 'Recarga el Work Order antes de hacer este cambio.',
    WORK_REQUEST_ALREADY_HANDLED: 'Esta solicitud de trabajo ya fue atendida.',
    WO_CLOSED: 'Este Work Order está cerrado.',
  },
};
