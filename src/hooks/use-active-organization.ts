/**
 * Active organization from profile.organization_id and role from organization_members.
 */
import { useAuth } from '@/lib/auth-context';
import { useMyMemberships } from '@/hooks/use-my-memberships';
import type { AppRole } from '@/types';

export function useActiveOrganization(): {
  organizationId: string | null;
  role: AppRole | null;
  isOrgAdmin: boolean;
  loading: boolean;
} {
  const { profile, loading: authLoading } = useAuth();
  const { activeMemberships, loading: membershipsLoading } = useMyMemberships();

  const orgId = profile?.organization_id ?? null;
  const activeMember = orgId
    ? activeMemberships.find((m) => m.organization_id === orgId)
    : null;
  const role = (activeMember?.role as AppRole) ?? null;
  const isOrgAdmin = role === 'admin' || role === 'manager';

  return {
    organizationId: orgId,
    role,
    isOrgAdmin,
    loading: authLoading || membershipsLoading,
  };
}
