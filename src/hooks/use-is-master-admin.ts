/**
 * Check if the current user is master admin (user_roles.role = 'admin', organization_id IS NULL).
 * Used for /admin/* gating and sidebar link.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';

export function useIsMasterAdmin(): {
  isMasterAdmin: boolean;
  loading: boolean;
  refetch: () => void;
} {
  const { user, loading: authLoading } = useAuth();

  const { data: masterAdminRow, isLoading, refetch } = useQuery({
    queryKey: ['master-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('user_id', user.id)
        .is('organization_id', null)
        .eq('role', 'admin')
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isMasterAdmin: !!masterAdminRow,
    loading: authLoading || isLoading,
    refetch,
  };
}
