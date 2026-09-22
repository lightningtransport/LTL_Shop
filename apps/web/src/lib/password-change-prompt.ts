const PASSWORD_CHANGE_FLAG_KEYS = [
  'mustChangePassword',
  'must_change_password',
  'passwordChangeRequired',
  'password_change_required',
] as const;

const METADATA_KEYS = ['app_metadata', 'user_metadata', 'appMetadata', 'userMetadata'] as const;

export const PASSWORD_CHANGE_RESOLVED_KEY = 'ltl_shop_password_change_resolved';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function policyRequiresPasswordChange(input: {
  user: unknown;
  accessToken: string | null;
  passwordRecovery: boolean;
}) {
  if (input.passwordRecovery) return true;
  if (recordRequiresPasswordChange(input.user)) return true;
  return tokenRequiresPasswordChange(input.accessToken);
}

/**
 * Menu opens the Update password sheet only while policy still requires a
 * change and this session has not already completed or dismissed it.
 */
export function shouldOpenUpdatePasswordSheet(input: {
  policyRequiresPasswordChange: boolean;
  passwordChangeResolved: boolean;
}) {
  return input.policyRequiresPasswordChange && !input.passwordChangeResolved;
}

export function readPasswordChangeResolved(userId: string, storage: StorageLike | null) {
  return readResolvedIds(storage).includes(userId);
}

export function writePasswordChangeResolved(userId: string, resolved: boolean, storage: StorageLike | null) {
  if (!storage) return;
  const ids = readResolvedIds(storage);
  const next = resolved
    ? Array.from(new Set([...ids, userId]))
    : ids.filter((id) => id !== userId);
  storage.setItem(PASSWORD_CHANGE_RESOLVED_KEY, JSON.stringify(next));
}

export function updatePasswordSheetCopy(locale: 'en' | 'es') {
  if (locale === 'es') {
    return {
      title: 'Actualizar contraseña',
      description: 'La política de tu cuenta exige una nueva contraseña para esta sesión.',
      newPassword: 'Nueva contraseña',
      confirmPassword: 'Confirmar nueva contraseña',
      hint: 'Usa al menos 8 caracteres.',
      submit: 'Actualizar contraseña',
      submitting: 'Actualizando contraseña…',
      tooShort: 'Usa al menos 8 caracteres para la nueva contraseña.',
      mismatch: 'Las contraseñas no coinciden.',
      dismiss: 'Ahora no',
      close: 'Cerrar actualización de contraseña',
      unable: 'No se pudo actualizar la contraseña.',
    };
  }
  return {
    title: 'Update password',
    description: 'Your account policy requires a new password for this session.',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    hint: 'Use at least 8 characters.',
    submit: 'Update password',
    submitting: 'Updating password…',
    tooShort: 'Use at least 8 characters for your new password.',
    mismatch: 'The passwords do not match.',
    dismiss: 'Not now',
    close: 'Close update password',
    unable: 'Unable to update password.',
  };
}

function tokenRequiresPasswordChange(accessToken: string | null) {
  if (!accessToken || accessToken.startsWith('dev:')) return false;
  return recordRequiresPasswordChange(decodeJwtPayload(accessToken));
}

function recordRequiresPasswordChange(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) return false;
  if (PASSWORD_CHANGE_FLAG_KEYS.some((key) => isTruthyFlag(record[key]))) return true;
  return METADATA_KEYS.some((key) => {
    const metadata = asRecord(record[key]);
    return !!metadata && PASSWORD_CHANGE_FLAG_KEYS.some((flag) => isTruthyFlag(metadata[flag]));
  });
}

function isTruthyFlag(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const parsed = JSON.parse(atob(padded)) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function readResolvedIds(storage: StorageLike | null) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(PASSWORD_CHANGE_RESOLVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}
