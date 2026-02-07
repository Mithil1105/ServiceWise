import { useAuth } from '@/lib/auth-context';
import type { AppRole } from '@/types';
import type { Profile } from '@/types';

/**
 * Minimal org hook: current profile, org id, and role.
 * One org per user; no org switcher.
 */
export function useOrg(): {
  profile: Profile | null;
  orgId: string | null;
  role: AppRole | null;
  loading: boolean;
} {
  const { profile, role, loading } = useAuth();
  const orgId = profile?.organization_id ?? null;
  return { profile: profile ?? null, orgId, role, loading };
}
