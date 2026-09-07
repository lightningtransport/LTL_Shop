import { UserRole } from '@ltl-shop/shared';

export function postLoginPath(role: UserRole, requestedPath?: string | null) {
  if (role !== UserRole.MANAGER && role !== UserRole.ADMIN) return '/';
  if (requestedPath?.startsWith('/admin') && !requestedPath.startsWith('//')) {
    return requestedPath;
  }
  return '/admin';
}
