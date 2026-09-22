import { UserRole, type UserDto } from '@ltl-shop/shared';
import { ApiError } from './api';

/** System Admin is `role === admin`. Shop Manager also has `admin.access`. */
export function isSystemAdmin(user: Pick<UserDto, 'role'> | null | undefined): boolean {
  return user?.role === UserRole.ADMIN;
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
