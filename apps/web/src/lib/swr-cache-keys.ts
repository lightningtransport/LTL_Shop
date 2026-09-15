const INFINITE_PREFIX = '$inf$';

export function cacheKeyPath(key: unknown): string | null {
  if (typeof key !== 'string' || key.length === 0) return null;
  return key.startsWith(INFINITE_PREFIX) ? key.slice(INFINITE_PREFIX.length) : key;
}

function isCollectionPath(path: string | null, prefix: string): boolean {
  return path === prefix || Boolean(path?.startsWith(`${prefix}?`));
}

export function isMechanicWorkOrdersListKey(key: unknown): boolean {
  return isCollectionPath(cacheKeyPath(key), '/api/work-orders');
}

export function isAdminWorkOrdersListKey(key: unknown): boolean {
  return isCollectionPath(cacheKeyPath(key), '/api/admin/work-orders');
}

export function isAdminDashboardKey(key: unknown): boolean {
  return cacheKeyPath(key) === '/api/admin/dashboard';
}

export function isAdminHistoryListKey(key: unknown): boolean {
  return isCollectionPath(cacheKeyPath(key), '/api/admin/history');
}

export function isAdminYardListKey(key: unknown): boolean {
  return isCollectionPath(cacheKeyPath(key), '/api/admin/yard-operations');
}

export function isAdminTrucksListKey(key: unknown): boolean {
  return isCollectionPath(cacheKeyPath(key), '/api/admin/trucks');
}

export function isRepairHistoryKey(key: unknown): boolean {
  const path = cacheKeyPath(key);
  return Boolean(path?.includes('/repair-history'));
}

/** Lists that must refresh after a Work Order is created or its status/jobs change. */
export function isWorkOrderRelatedListKey(key: unknown): boolean {
  return (
    isMechanicWorkOrdersListKey(key)
    || isAdminWorkOrdersListKey(key)
    || isAdminDashboardKey(key)
    || isAdminHistoryListKey(key)
    || isAdminYardListKey(key)
    || isRepairHistoryKey(key)
  );
}

/** Lists that must refresh after Yard / readiness / Work Plan mutations. */
export function isYardRelatedListKey(key: unknown): boolean {
  return (
    isAdminYardListKey(key)
    || isAdminDashboardKey(key)
    || isAdminTrucksListKey(key)
    || isAdminWorkOrdersListKey(key)
  );
}
