'use client';

import { useUser } from '@clerk/nextjs';
import { hasPermission, hasAnyPermission as _hasAny, isValidRole, type CrmRole } from './permissions';

export function usePermission(permission: string): boolean {
  const { user } = useUser();
  const role = user?.publicMetadata?.role;
  if (!isValidRole(role)) return false;
  return hasPermission(role, permission);
}

export function useAnyPermission(permissions: string[]): boolean {
  const { user } = useUser();
  const role = user?.publicMetadata?.role;
  if (!isValidRole(role)) return false;
  return _hasAny(role, permissions);
}

export function useCrmRole(): CrmRole | null {
  const { user } = useUser();
  const role = user?.publicMetadata?.role;
  return isValidRole(role) ? role : null;
}
