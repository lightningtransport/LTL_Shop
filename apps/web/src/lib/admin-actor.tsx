'use client';

import { createContext, useContext } from 'react';
import { useAuth } from './auth-context';
import { canManagePerson, canShowManagerWrites, isSystemAdmin, isSystemAdminRole } from './system-admin';

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

/** LTR-253 / D48: the viewer is a System Admin (adds and changes Shop Managers and System Admins). */
export function useIsSystemAdmin(): boolean {
  const sessionRole = useContext(AdminActorRoleContext);
  const { user } = useAuth();
  return isSystemAdminRole(sessionRole) || isSystemAdmin(user);
}

/** LTR-253 / D48: whether the viewer may act on a person of this role in People, and whether that person is them. */
export function usePersonAccess(person: { id: string; role: string } | null | undefined): { canManage: boolean; isSelf: boolean } {
  const sessionRole = useContext(AdminActorRoleContext);
  const { user } = useAuth();
  if (!person) return { canManage: false, isSelf: false };
  return { canManage: canManagePerson(sessionRole, user, person.role), isSelf: user?.id === person.id };
}

/** D22 roster and D25 Job catalog: the Shop Manager and the System Admin write them. */
export function useCanShowManagerWrites(): boolean {
  const sessionRole = useContext(AdminActorRoleContext);
  const { user } = useAuth();
  return canShowManagerWrites(sessionRole, user);
}
