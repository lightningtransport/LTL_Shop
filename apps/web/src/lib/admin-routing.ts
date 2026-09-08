import { AppCapability, type UserDto } from '@ltl-shop/shared';

export function hasCapability(
  user: Pick<UserDto, 'capabilities'> | null | undefined,
  capability: AppCapability,
) {
  return !!user?.capabilities.includes(capability);
}

export function defaultWorkspacePath(user: Pick<UserDto, 'capabilities'>) {
  if (hasCapability(user, AppCapability.ADMIN_ACCESS)) return '/admin';
  if (hasCapability(user, AppCapability.MECHANIC_STANDARD)) return '/mechanic/standard';
  if (hasCapability(user, AppCapability.MECHANIC_PM)) return '/mechanic/pm';
  return '/access-denied';
}

export function postLoginPath(user: Pick<UserDto, 'capabilities'>, requestedPath?: string | null) {
  if (
    hasCapability(user, AppCapability.ADMIN_ACCESS) &&
    requestedPath?.startsWith('/admin') &&
    !requestedPath.startsWith('//')
  ) {
    return requestedPath;
  }
  return defaultWorkspacePath(user);
}
