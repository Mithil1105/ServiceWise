import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SupervisorActivity {
  id: string;
  supervisor_id: string;
  car_id: string | null;
  action_type: string;
  action_details: Record<string, unknown> | null;
  created_at: string;
}

export interface SupervisorActivityWithDetails extends SupervisorActivity {
  cars?: {
    id: string;
    vehicle_number: string;
    model: string;
  } | null;
  supervisor?: {
    id: string;
    name: string;
  } | null;
}

// Get all activity logs (for admin/manager view)
export function useSupervisorActivityLogs(supervisorId?: string) {
  return useQuery({
    queryKey: ['supervisor-activity-logs', supervisorId],
    queryFn: async () => {
      let query = supabase
        .from('supervisor_activity_log')
        .select(`
          *,
          cars:car_id (id, vehicle_number, model)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (supervisorId) {
        query = query.eq('supervisor_id', supervisorId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch supervisor profiles
      const supervisorIds = [...new Set(data.map((a) => a.supervisor_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', supervisorIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return data.map((a) => ({
        ...a,
        supervisor: profileMap.get(a.supervisor_id),
      })) as SupervisorActivityWithDetails[];
    },
  });
}

// Log an activity
export function useLogSupervisorActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      carId,
      actionType,
      actionDetails,
    }: {
      carId?: string;
      actionType: string;
      actionDetails?: Record<string, string | number | boolean | null>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('supervisor_activity_log')
        .insert([{
          supervisor_id: user.id,
          car_id: carId || null,
          action_type: actionType,
          action_details: actionDetails as unknown as Record<string, never> || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisor-activity-logs'] });
    },
  });
}
