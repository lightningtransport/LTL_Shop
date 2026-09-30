'use client';

import { createContext, useContext } from 'react';
import { useAuth } from './auth-context';
import { canShowAdminWrites, canShowRosterWrites } from './system-admin';

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

export function useCanShowAdminWrites(): boolean {
  const sessionRole = useContext(AdminActorRoleContext);
  const { user } = useAuth();
  return canShowAdminWrites(sessionRole, user);
}

/** D22: roster writes (people) open to the Shop Manager too; catalog writes stay on `useCanShowAdminWrites`. */
export function useCanShowRosterWrites(): boolean {
  const sessionRole = useContext(AdminActorRoleContext);
  const { user } = useAuth();
  return canShowRosterWrites(sessionRole, user);
}
