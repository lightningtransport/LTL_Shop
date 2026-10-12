import type { ShopLocale } from './shop-locale';

/**
 * LTR-181: every `code` the API throws (grep `code: '` in apps/api/src), plus the two transport
 * failures, with one short sentence per language. Both UI catalogs expose this object as
 * `apiError`, so `apiErrorMessage()` (api-error-message.ts) reads it from either one.
 * Keys with a shared audience avoid the Truck/unidad noun; the QC keys are Safety copy (unidad).
 */
export type ApiErrorCode =
  | 'LABOR_RATE_DATE_TAKEN'
  | 'LABOR_RATE_NOT_LATEST'
  | 'LABOR_RATE_IN_USE'
  | 'CUSTOM_JOB_GROUP_NOT_FOUND'
  | 'CATALOG_NAME_INVALID'
  | 'INTERNAL_INVOICE_DRAFT_EXISTS'
  | 'NOTHING_TO_CHARGE'
  | 'INVOICE_NOT_DRAFT'
  | 'INVOICE_NOT_SENT'
  | 'INVOICE_EMPTY'
  | 'LINE_ALREADY_CHARGED'
  | 'DUPLICATE_INVOICE'
  | 'REPAIR_VOIDED'
  | 'JOB_NOT_ON_TRUCK'
  | 'JOB_NEVER_EXTERNAL'
  | 'TOTAL_MISMATCH'
  | 'PURCHASE_VOIDED'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'ATTACHMENT_NOT_FOUND'
  | 'FILES_NOT_CONFIGURED'
  | 'FILES_UNAVAILABLE'
  | 'PART_NOT_FOUND'
  | 'TRUCK_NOT_FOUND'
  | 'PART_IN_OPEN_PM'
  | 'PART_EXISTS'
  | 'PART_CATEGORY_NOT_FOUND'
  | 'VENDOR_NAME_TAKEN'
  | 'VENDOR_NOT_ACTIVE'
  | 'VENDOR_NEEDS_KIND'
  | 'PERSON_HAS_HISTORY'
  | 'PERSON_REMOVED'
  | 'ALIAS_EMPTY'
  | 'ALIAS_IS_JOB_NAME'
  | 'CATALOG_CATEGORY_EXISTS'
  | 'CATALOG_CATEGORY_IN_USE'
  | 'CATALOG_JOB_IN_USE'
  | 'CATEGORY_HAS_SYSTEM_JOB'
  | 'SYSTEM_CATEGORY_LOCKED'
  | 'SYSTEM_JOB_LOCKED'
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
  | 'JOB_ALREADY_TAKEN'
  | 'JOB_NOT_IN_TEAM_QUEUE'
  | 'JOB_RELEASE_CLOCK_RUNNING'
  | 'NOT_ON_STEP_TEAM'
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
    LABOR_RATE_DATE_TAKEN: 'There is already a rate from that date. Pick another date.',
    LABOR_RATE_NOT_LATEST: 'Only the latest rate can be removed.',
    LABOR_RATE_IN_USE: 'Labor priced with this rate is already on a sent invoice. Set a new rate from another date instead.',
    CUSTOM_JOB_GROUP_NOT_FOUND: 'Those Custom Jobs were already reviewed. Reload the inbox.',
    CATALOG_NAME_INVALID: 'Use letters or numbers in the name.',
    INTERNAL_INVOICE_DRAFT_EXISTS: 'There is already a draft for this truck and month.',
    NOTHING_TO_CHARGE: 'This truck has nothing left to charge up to the end of that month.',
    INVOICE_NOT_DRAFT: 'A sent invoice does not change. Void it and make another.',
    INVOICE_NOT_SENT: 'Only a sent invoice can do that.',
    INVOICE_EMPTY: 'Put at least one line on the invoice before sending it.',
    LINE_ALREADY_CHARGED: 'That movement is already on another invoice.',
    DUPLICATE_INVOICE: 'That invoice from this vendor is already saved.',
    REPAIR_VOIDED: 'This outside repair is voided. Load it again instead.',
    JOB_NOT_ON_TRUCK: 'That Job is not on this truck.',
    JOB_NEVER_EXTERNAL: 'That Job was never sent to an external shop.',
    TOTAL_MISMATCH: 'The total changed. Check the lines, tax and freight, and save again.',
    PURCHASE_VOIDED: 'This purchase is voided. Load it again instead.',
    IDEMPOTENCY_KEY_REQUIRED: 'Could not save. Close the form and try again.',
    ATTACHMENT_NOT_FOUND: 'The invoice file was not found. Attach it again.',
    FILES_NOT_CONFIGURED: 'Invoice files are not set up in this environment.',
    FILES_UNAVAILABLE: 'The file service did not answer. Try again.',
    PART_NOT_FOUND: 'A part on this purchase is no longer in the catalog.',
    TRUCK_NOT_FOUND: 'A truck on this purchase does not exist.',
    PART_IN_OPEN_PM: 'This part is picked in a PM in progress. Change it after that PM is finished.',
    PART_EXISTS: 'That part is already in this category.',
    PART_CATEGORY_NOT_FOUND: 'That category no longer exists. Reload the page.',
    VENDOR_NAME_TAKEN: 'A vendor with that name already exists.',
    VENDOR_NOT_ACTIVE: 'Pick an active vendor.',
    VENDOR_NEEDS_KIND: 'A vendor sells parts, does outside repairs, or both.',
    PERSON_HAS_HISTORY: 'This person has history in the Shop, so they cannot be deleted. Remove them from the Shop instead.',
    PERSON_REMOVED: 'This person was removed from the Shop. To bring them back, add them again.',
    ALIAS_EMPTY: 'An alias needs a letter or a number.',
    ALIAS_IS_JOB_NAME: "The Job's own name is always an alias. Rename the Job instead.",
    CATALOG_CATEGORY_EXISTS: 'A Category with this name already exists.',
    CATALOG_CATEGORY_IN_USE: 'Only an empty Category that was never used can be deleted. Deactivate it instead.',
    CATALOG_JOB_IN_USE: 'Work Orders already use this Job, so it cannot be deleted. Deactivate it instead.',
    CATEGORY_HAS_SYSTEM_JOB: 'This Category holds a Shop workflow Job, so it stays active.',
    SYSTEM_CATEGORY_LOCKED: 'This Category belongs to the Shop workflow and cannot be renamed, deactivated or deleted.',
    SYSTEM_JOB_LOCKED: 'This Job is part of the Shop workflow; it cannot be deactivated or deleted.',
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
    JOB_ALREADY_TAKEN: 'Someone on your team already took this Job.',
    JOB_NOT_IN_TEAM_QUEUE: 'This Job is no longer waiting in your team queue.',
    JOB_RELEASE_CLOCK_RUNNING: 'Your time is running on this truck. Finish or report a blocker, or ask the Shop Manager to reassign it.',
    NOT_ON_STEP_TEAM: 'Only someone on this step\'s team can take it.',
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
    LABOR_RATE_DATE_TAKEN: 'Ya hay una tarifa desde esa fecha. Elige otra fecha.',
    LABOR_RATE_NOT_LATEST: 'Solo se puede quitar la última tarifa.',
    LABOR_RATE_IN_USE: 'Mano de obra con esta tarifa ya está en una factura enviada. Pon una tarifa nueva desde otra fecha.',
    CUSTOM_JOB_GROUP_NOT_FOUND: 'Esos Custom Jobs ya se revisaron. Vuelve a cargar la bandeja.',
    CATALOG_NAME_INVALID: 'Usa letras o números en el nombre.',
    INTERNAL_INVOICE_DRAFT_EXISTS: 'Ya hay un borrador para este camión y mes.',
    NOTHING_TO_CHARGE: 'Este camión no tiene nada pendiente de cobrar hasta el fin de ese mes.',
    INVOICE_NOT_DRAFT: 'Una factura enviada no cambia. Anúlala y arma otra.',
    INVOICE_NOT_SENT: 'Solo una factura enviada puede hacer eso.',
    INVOICE_EMPTY: 'Pon al menos una línea en la factura antes de enviarla.',
    LINE_ALREADY_CHARGED: 'Ese movimiento ya está en otra factura.',
    DUPLICATE_INVOICE: 'Esa factura de este proveedor ya está cargada.',
    REPAIR_VOIDED: 'Esta reparación externa está anulada. Cárgala de nuevo.',
    JOB_NOT_ON_TRUCK: 'Ese Job no es de este camión.',
    JOB_NEVER_EXTERNAL: 'Ese Job nunca salió a un taller externo.',
    TOTAL_MISMATCH: 'El total cambió. Revisa las líneas, el impuesto y el flete, y guarda otra vez.',
    PURCHASE_VOIDED: 'Esta compra está anulada. Cárgala de nuevo.',
    IDEMPOTENCY_KEY_REQUIRED: 'No se pudo guardar. Cierra el formulario e inténtalo de nuevo.',
    ATTACHMENT_NOT_FOUND: 'No se encontró la factura adjunta. Adjúntala de nuevo.',
    FILES_NOT_CONFIGURED: 'Las facturas adjuntas no están configuradas en este entorno.',
    FILES_UNAVAILABLE: 'El servicio de archivos no respondió. Inténtalo de nuevo.',
    PART_NOT_FOUND: 'Una parte de esta compra ya no está en el catálogo.',
    TRUCK_NOT_FOUND: 'Un camión de esta compra no existe.',
    PART_IN_OPEN_PM: 'Esta parte está elegida en un PM en curso. Cámbiala cuando ese PM termine.',
    PART_EXISTS: 'Esa parte ya está en esta categoría.',
    PART_CATEGORY_NOT_FOUND: 'Esa categoría ya no existe. Vuelve a cargar la página.',
    VENDOR_NAME_TAKEN: 'Ya existe un proveedor con ese nombre.',
    VENDOR_NOT_ACTIVE: 'Elige un proveedor activo.',
    VENDOR_NEEDS_KIND: 'Un proveedor vende partes, hace reparaciones afuera, o las dos cosas.',
    PERSON_HAS_HISTORY: 'Esta persona tiene historial en el taller, así que no se puede borrar. Quítala del Shop en su lugar.',
    PERSON_REMOVED: 'Esta persona fue quitada del Shop. Para que vuelva, agrégala de nuevo.',
    ALIAS_EMPTY: 'Un alias necesita una letra o un número.',
    ALIAS_IS_JOB_NAME: 'El nombre del Job siempre es un alias. Renombra el Job en su lugar.',
    CATALOG_CATEGORY_EXISTS: 'Ya existe una categoría con ese nombre.',
    CATALOG_CATEGORY_IN_USE: 'Solo se borra una categoría vacía que nunca se usó. Desactívala en su lugar.',
    CATALOG_JOB_IN_USE: 'Hay Work Orders que ya usan este Job, así que no se puede borrar. Desactívalo en su lugar.',
    CATEGORY_HAS_SYSTEM_JOB: 'Esta categoría tiene un Job del flujo del taller, así que sigue activa.',
    SYSTEM_CATEGORY_LOCKED: 'Esta categoría es del flujo del taller y no se puede renombrar, desactivar ni borrar.',
    SYSTEM_JOB_LOCKED: 'Este Job es parte del flujo del taller; no se puede desactivar ni borrar.',
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
    JOB_ALREADY_TAKEN: 'Alguien de tu equipo ya tomó este Job.',
    JOB_NOT_IN_TEAM_QUEUE: 'Este Job ya no está en la cola de tu equipo.',
    JOB_RELEASE_CLOCK_RUNNING: 'Tu tiempo está corriendo en este camión. Termina o reporta un bloqueo, o pide al Shop Manager que lo reasigne.',
    NOT_ON_STEP_TEAM: 'Solo alguien del equipo de este paso puede tomarlo.',
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
