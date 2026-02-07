/**
 * Current user's organization memberships (organization_members).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { AppRole } from '@/types';

export interface MembershipRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  organizations?: { id: string; name: string; join_code: string } | null;
}

export function useMyMemberships(): {
  memberships: MembershipRow[];
  activeMemberships: MembershipRow[];
  pendingMemberships: MembershipRow[];
  loading: boolean;
  refetch: () => void;
} {
  const { user, loading: authLoading } = useAuth();

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['my-memberships', user?.id],
    queryFn: async (): Promise<MembershipRow[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('organization_members')
        .select('id, organization_id, user_id, role, status, created_at, organizations(id, name, join_code)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data ?? []) as MembershipRow[];
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 2 * 60 * 1000,
  });

  const activeMemberships = rows.filter((m) => m.status === 'active');
  const pendingMemberships = rows.filter((m) => m.status === 'pending');

  return {
    memberships: rows,
    activeMemberships,
    pendingMemberships,
    loading: authLoading || isLoading,
    refetch,
  };
}
