import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useOrg } from '@/hooks/use-org';

export function useSnooze() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['snooze', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_snoozes')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useIsSnoozed() {
  const { data: snooze } = useSnooze();
  
  if (!snooze) return false;
  
  const now = new Date();
  const snoozeUntil = new Date(snooze.snooze_until);
  
  return now < snoozeUntil;
}

export function useDismissForToday() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { orgId } = useOrg();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      if (!orgId) throw new Error('Organization not found');
      
      // Calculate midnight tonight
      const midnight = new Date();
      midnight.setHours(23, 59, 59, 999);
      
      const { error } = await supabase
        .from('user_snoozes')
        .upsert({
          organization_id: orgId,
          user_id: user.id,
          snooze_until: midnight.toISOString(),
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snooze'] });
    },
  });
}
