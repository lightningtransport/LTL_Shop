import type { ShopLocale } from './shop-locale';

/**
 * LTR-181: every `code` the API throws (grep `code: '` in apps/api/src), plus the two transport
 * failures, with one short sentence per language. Both UI catalogs expose this object as
 * `apiError`, so `apiErrorMessage()` (api-error-message.ts) reads it from either one.
 * Keys with a shared audience avoid the Truck/unidad noun; the QC keys are Safety copy (unidad).
 */
export type ApiErrorCode =
  | 'ACTIVE_READINESS_ASSESSMENT_EXISTS'
  | 'AUTH_ACCOUNT_CREATE_FAILED'
  | 'AUTH_ACCOUNT_MISSING'
  | 'AUTH_NOT_CONFIGURED'
  | 'AUTH_PASSWORD_RESET_FAILED'
  | 'BLOCKER_ALREADY_ACTIVE'
  | 'BLOCKER_ALREADY_RESOLVED'
  | 'BLOCKER_NOT_YOURS'
  | 'BLOCKER_REASON_NOT_ALLOWED'
  | 'CATALOG_ALIAS_EXISTS'
  | 'CATALOG_CATEGORY_INACTIVE'
  | 'CATALOG_JOB_EXISTS'
  | 'CATALOG_JOB_IN_WORKFLOW'
  | 'DUPLICATE_STEP'
  | 'EXTERNAL_ALREADY'
  | 'EXTERNAL_NOT_ALLOWED_HERE'
  | 'HELPER_ALREADY_ADDED'
  | 'HELPER_INVALID_MECHANIC'
  | 'HELPER_JOB_NOT_OPEN'
  | 'HELPER_NOT_ALLOWED_HERE'
  | 'IDEMPOTENCY_KEY_REUSE'
  | 'JOB_AT_EXTERNAL_SHOP'
  | 'JOB_BLOCKED'
  | 'JOB_NOT_EXTERNAL'
  | 'JOB_NOT_ASSIGNED_TO_YOU'
  | 'JOB_NOT_PENDING'
  | 'LABOR_ALREADY_RUNNING'
  | 'MECHANIC_EMAIL_EXISTS'
  | 'MECHANIC_HAS_OPEN_WORK'
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
  | 'SHOP_HOURS_INVALID'
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
    AUTH_ACCOUNT_CREATE_FAILED: 'The access account could not be created. Nothing was saved; try again.',
    AUTH_ACCOUNT_MISSING: 'This person has no access account yet, so there is no password to reset.',
    AUTH_NOT_CONFIGURED: 'Access accounts are not managed in this environment.',
    AUTH_PASSWORD_RESET_FAILED: 'The password could not be reset. Try again.',
    BLOCKER_ALREADY_ACTIVE: 'This Job already has an active blocker.',
    BLOCKER_ALREADY_RESOLVED: 'This blocker was already resolved.',
    BLOCKER_NOT_YOURS: 'Only the mechanic who reported this blocker can add to it.',
    BLOCKER_REASON_NOT_ALLOWED: 'That blocker reason is not available here.',
    CATALOG_ALIAS_EXISTS: 'That alias is already used by another catalog Job.',
    CATALOG_CATEGORY_INACTIVE: 'This Job\'s Category is inactive, so the Job cannot be activated.',
    CATALOG_JOB_EXISTS: 'That Job name is already in the Job Catalog.',
    CATALOG_JOB_IN_WORKFLOW: 'This Job is a Shop workflow step. Change the step in Shop workflow before deactivating it.',
    DUPLICATE_STEP: 'This Work Order already has that step.',
    EXTERNAL_ALREADY: 'This Job is already at an external shop.',
    EXTERNAL_NOT_ALLOWED_HERE: 'The Quality Check cannot go to an external shop.',
    HELPER_ALREADY_ADDED: 'This mechanic is already helping on this Job.',
    HELPER_INVALID_MECHANIC: 'Choose an active Standard mechanic who does not own this Job.',
    HELPER_JOB_NOT_OPEN: 'A helper can only be added to a pending Job of an open Work Order.',
    HELPER_NOT_ALLOWED_HERE: 'This Job cannot have a helper (PM, Quality Check or a helper Job).',
    IDEMPOTENCY_KEY_REUSE: 'This request was already sent. Reload to see the result.',
    JOB_AT_EXTERNAL_SHOP: 'This Job is at an external shop. Use Returned first.',
    JOB_BLOCKED: 'This Job has an active blocker. The Manager resolves it first.',
    JOB_NOT_EXTERNAL: 'This Job is not at an external shop.',
    JOB_NOT_ASSIGNED_TO_YOU: 'This Job is not assigned to you.',
    JOB_NOT_PENDING: 'This Job is no longer pending.',
    LABOR_ALREADY_RUNNING: 'Your labor time is already running.',
    MECHANIC_EMAIL_EXISTS: 'That email already belongs to an active Shop user.',
    MECHANIC_HAS_OPEN_WORK: 'Reassign this person\'s pending Jobs and stop their labor time before deactivating.',
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
    SHOP_HOURS_INVALID: 'Choose a day close between 12:00 p.m. and 11:59 p.m. and at least one workday.',
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
    AUTH_ACCOUNT_CREATE_FAILED: 'No se pudo crear la cuenta de acceso. No se guardó nada; inténtalo de nuevo.',
    AUTH_ACCOUNT_MISSING: 'Esta persona todavía no tiene cuenta de acceso, así que no hay contraseña que reiniciar.',
    AUTH_NOT_CONFIGURED: 'Las cuentas de acceso no se manejan en este entorno.',
    AUTH_PASSWORD_RESET_FAILED: 'No se pudo reiniciar la contraseña. Inténtalo de nuevo.',
    BLOCKER_ALREADY_ACTIVE: 'Este Job ya tiene un bloqueo activo.',
    BLOCKER_ALREADY_RESOLVED: 'Este bloqueo ya fue resuelto.',
    BLOCKER_NOT_YOURS: 'Solo el mecánico que reportó este bloqueo puede agregarle notas.',
    BLOCKER_REASON_NOT_ALLOWED: 'Ese motivo de bloqueo no está disponible aquí.',
    CATALOG_ALIAS_EXISTS: 'Ese alias ya lo usa otro Job del catálogo.',
    CATALOG_CATEGORY_INACTIVE: 'La categoría de este Job está inactiva, así que el Job no se puede activar.',
    CATALOG_JOB_EXISTS: 'Ese nombre de Job ya está en el Job Catalog.',
    CATALOG_JOB_IN_WORKFLOW: 'Este Job es un paso del Shop workflow. Cambia el paso en Shop workflow antes de desactivarlo.',
    DUPLICATE_STEP: 'Este Work Order ya tiene ese paso.',
    EXTERNAL_ALREADY: 'Este Job ya está en un taller externo.',
    EXTERNAL_NOT_ALLOWED_HERE: 'El Quality Check no puede ir a un taller externo.',
    HELPER_ALREADY_ADDED: 'Este mecánico ya es ayudante en este Job.',
    HELPER_INVALID_MECHANIC: 'Elige un mecánico Standard activo que no sea el dueño de este Job.',
    HELPER_JOB_NOT_OPEN: 'Solo se agrega un ayudante a un Job pendiente de un Work Order abierto.',
    HELPER_NOT_ALLOWED_HERE: 'Este Job no admite ayudante (PM, Quality Check o Job de ayudante).',
    IDEMPOTENCY_KEY_REUSE: 'Esta solicitud ya se envió. Recarga para ver el resultado.',
    JOB_AT_EXTERNAL_SHOP: 'Este Job está en un taller externo. Primero usa "Regresó".',
    JOB_BLOCKED: 'Este Job tiene un bloqueo activo. El Manager lo resuelve primero.',
    JOB_NOT_EXTERNAL: 'Este Job no está en un taller externo.',
    JOB_NOT_ASSIGNED_TO_YOU: 'Este Job no está asignado a ti.',
    JOB_NOT_PENDING: 'Este Job ya no está pendiente.',
    LABOR_ALREADY_RUNNING: 'Tu tiempo de labor ya está corriendo.',
    MECHANIC_EMAIL_EXISTS: 'Ese email ya pertenece a un usuario activo del Shop.',
    MECHANIC_HAS_OPEN_WORK: 'Reasigna los Jobs pendientes de esta persona y detén su tiempo antes de desactivarla.',
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
    SHOP_HOURS_INVALID: 'Elige un cierre del día entre las 12:00 p. m. y las 11:59 p. m. y al menos un día hábil.',
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
