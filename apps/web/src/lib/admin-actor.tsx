'use client';

import { createContext, useContext } from 'react';
import { useAuth } from './auth-context';
import { canShowAdminWrites } from './system-admin';

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
