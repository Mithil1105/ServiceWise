import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

/** Update organization (company_name, logo_url). Refreshes auth context after. */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const { profile, refreshUser } = useAuth();
  const orgId = profile?.organization_id ?? null;

  return useMutation({
    mutationFn: async (updates: { company_name?: string | null; logo_url?: string | null }) => {
      if (!orgId) throw new Error('Organization not found');
      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', orgId);
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
      await refreshUser();
      toast.success('Organization updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
