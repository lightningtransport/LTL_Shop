import { UserRole, type UserDto } from '@ltl-shop/shared';
import { ApiError } from './api';

/** System Admin is `role === admin`. Shop Manager also has `admin.access`. */
export function isSystemAdminRole(role: string | null | undefined): boolean {
  return role === UserRole.ADMIN;
}

export function isSystemAdmin(user: Pick<UserDto, 'role'> | null | undefined): boolean {
  return isSystemAdminRole(user?.role);
}

/**
 * Roster and catalog writes follow the Admin request role from middleware,
 * and the client profile when that has loaded. Either source must be
 * `role === admin`. `admin.access` is not a write grant.
 *
 * The client profile is null on the first paint and stays null when profile
 * restore fails, which left these screens on the read-only subtitle.
 */
export function canShowAdminWrites(
  sessionRole: string | null | undefined,
  user: Pick<UserDto, 'role'> | null | undefined,
): boolean {
  return isSystemAdminRole(sessionRole) || isSystemAdmin(user);
}

export function isRosterEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function adminWriteFailureMessage(
  error: unknown,
  copy: { forbidden: string; conflict: string; failed: string },
): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return copy.forbidden;
    if (error.status === 409) return copy.conflict;
    if (error.status === 400 && error.message) return error.message;
  }
  return copy.failed;
}
