import { AppCapability, UserRole, type AdminMechanicOpenWorkDto, type UserDto } from '@ltl-shop/shared';
import { ApiError } from './api';
import { apiErrorCode, apiErrorMessage, type ApiErrorCatalog } from './api-error-message';

/** System Admin is `role === admin`. Shop Manager also has `admin.access`. */
export function isSystemAdminRole(role: string | null | undefined): boolean {
  return role === UserRole.ADMIN;
}

export function isSystemAdmin(user: Pick<UserDto, 'role'> | null | undefined): boolean {
  return isSystemAdminRole(user?.role);
}

/**
 * D22 / LTR-187 (roster) and D25 (Job catalog): these Admin writes belong to the Shop Manager as
 * well as the System Admin. Mirrors the API's `ManagerWritesGuard`: role admin, or the Work Order
 * write pair (`admin.access` + `work_orders.manage`). The session role alone (before the profile
 * loads) opens it for manager and admin; a loaded profile decides by capabilities. Either source
 * with `role === admin` opens it (the profile is null on the first paint and when restore fails).
 */
export function canShowManagerWrites(
  sessionRole: string | null | undefined,
  user: Pick<UserDto, 'role' | 'capabilities'> | null | undefined,
): boolean {
  if (isSystemAdminRole(sessionRole) || isSystemAdmin(user)) return true;
  if (user) {
    return user.capabilities.includes(AppCapability.ADMIN_ACCESS)
      && user.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
  }
  return sessionRole === UserRole.MANAGER;
}

/** D22: the `MECHANIC_HAS_OPEN_WORK` body, when that is what the API refused with. */
export function mechanicOpenWorkFromError(error: unknown): Pick<AdminMechanicOpenWorkDto, 'pendingJobs' | 'runningSession'> | null {
  if (!(error instanceof ApiError) || apiErrorCode(error) !== 'MECHANIC_HAS_OPEN_WORK') return null;
  const body = error.body as Partial<AdminMechanicOpenWorkDto>;
  const pendingJobs = Array.isArray(body.pendingJobs)
    ? body.pendingJobs.filter((job): job is AdminMechanicOpenWorkDto['pendingJobs'][number] =>
        !!job && typeof job === 'object' && typeof job.workOrderId === 'string' && typeof job.jobDisplayName === 'string')
    : [];
  return { pendingJobs, runningSession: body.runningSession === true };
}

export function isRosterEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function adminWriteFailureMessage(
  error: unknown,
  copy: { forbidden: string; conflict: string; failed: string } & Partial<ApiErrorCatalog>,
): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return copy.forbidden;
    // D22: a coded 409 (open work, missing account) has its own sentence in the catalog.
    if (error.status === 409) {
      const code = apiErrorCode(error);
      if (code && code !== 'MECHANIC_EMAIL_EXISTS' && copy.locale && copy.apiError && code in copy.apiError) {
        return copy.apiError[code as keyof typeof copy.apiError];
      }
      return copy.conflict;
    }
    if ((error.status === 502 || error.status === 503) && copy.locale && copy.apiError) {
      return apiErrorMessage(error, { locale: copy.locale, apiError: copy.apiError }, copy.failed);
    }
    if (error.status === 400) {
      // LTR-181: with the catalog, known codes are localized and Spanish never shows the raw API text.
      if (copy.locale && copy.apiError) return apiErrorMessage(error, { locale: copy.locale, apiError: copy.apiError }, copy.failed);
      if (error.message) return error.message;
    }
  }
  return copy.failed;
}
