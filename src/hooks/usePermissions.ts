import { useAuth } from '@/contexts/AuthContext';
import { permissions, Permissions, PermissionRole } from '@/config/permissions';

export function usePermissions(): Permissions | null {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  let effectiveRole: PermissionRole;

  if (user.isMaster) {
    effectiveRole = 'master';
  } else if (user.activeRole === 'admin') {
    effectiveRole = 'admin';
  } else {
    effectiveRole = 'supplier';
  }

  return permissions[effectiveRole] ?? permissions['supplier'];
}
