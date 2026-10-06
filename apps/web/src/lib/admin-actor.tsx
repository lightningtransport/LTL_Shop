'use client';

import { createContext, useContext } from 'react';
import { useAuth } from './auth-context';
import { canShowManagerWrites } from './system-admin';

const AdminActorRoleContext = createContext('manager');

export function AdminActorProvider({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  return <AdminActorRoleContext.Provider value={role}>{children}</AdminActorRoleContext.Provider>;
}

/** D22 roster and D25 Job catalog: the Shop Manager and the System Admin write them. */
export function useCanShowManagerWrites(): boolean {
  const sessionRole = useContext(AdminActorRoleContext);
  const { user } = useAuth();
  return canShowManagerWrites(sessionRole, user);
}
