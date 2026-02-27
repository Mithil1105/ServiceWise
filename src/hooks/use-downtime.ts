import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DowntimeLog } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/hooks/use-org';

export function useDowntimeLogs(carId?: string) {
  return useQuery({
    queryKey: ['downtime-logs', carId],
    queryFn: async () => {
      let query = supabase
        .from('downtime_logs')
        .select('*')
        .order('started_at', { ascending: false });
      
      if (carId) {
        query = query.eq('car_id', carId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as DowntimeLog[];
    },
  });
}

export function useActiveDowntime(carId: string) {
  return useQuery({
    queryKey: ['active-downtime', carId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('downtime_logs')
        .select('*')
        .eq('car_id', carId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as DowntimeLog | null;
    },
    enabled: !!carId,
  });
}

export function useCarsInDowntime() {
  return useQuery({
    queryKey: ['cars-in-downtime'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('downtime_logs')
        .select('*, cars(vehicle_number, model)')
        .is('ended_at', null);
      
      if (error) throw error;
      return data;
    },
  });
}

export function useStartDowntime() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { orgId } = useOrg();

  return useMutation({
    mutationFn: async (params: {
      car_id: string;
      reason: DowntimeLog['reason'];
      notes?: string;
      estimated_uptime_at?: string;
      custom_attributes?: Record<string, string | number | boolean | null>;
    }) => {
      if (!orgId) throw new Error('Organization not found');
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('downtime_logs')
        .insert({
          organization_id: orgId,
          car_id: params.car_id,
          reason: params.reason,
          notes: params.notes,
          estimated_uptime_at: params.estimated_uptime_at,
          custom_attributes: params.custom_attributes ?? undefined,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Log supervisor activity if user is supervisor
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .single();
      if (userRole?.role === 'supervisor') {
        await supabase.from('supervisor_activity_log').insert({
          organization_id: orgId,
          supervisor_id: user?.id,
          car_id: params.car_id,
          action_type: 'downtime_started',
          action_details: {
            reason: params.reason,
            notes: params.notes ?? null,
            estimated_uptime_at: params.estimated_uptime_at ?? null,
          },
        });
      }

      return data as DowntimeLog;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['downtime-logs'] });
      queryClient.invalidateQueries({ queryKey: ['active-downtime', variables.car_id] });
      queryClient.invalidateQueries({ queryKey: ['cars-in-downtime'] });
      queryClient.invalidateQueries({ queryKey: ['attention-items'] });
      queryClient.invalidateQueries({ queryKey: ['supervisor-activity-logs'] });
      toast({
        title: 'Downtime started',
        description: 'Car marked as unavailable.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useEndDowntime() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { orgId } = useOrg();

  return useMutation({
    mutationFn: async (downtimeId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('downtime_logs')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', downtimeId)
        .select()
        .single();
      
      if (error) throw error;

      if (orgId && user) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        if (userRole?.role === 'supervisor') {
          await supabase.from('supervisor_activity_log').insert({
            organization_id: orgId,
            supervisor_id: user.id,
            car_id: data.car_id,
            action_type: 'downtime_ended',
            action_details: { reason: data.reason },
          });
        }
      }

      return data as DowntimeLog;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['downtime-logs'] });
      queryClient.invalidateQueries({ queryKey: ['supervisor-activity-logs'] });
      queryClient.invalidateQueries({ queryKey: ['active-downtime', data.car_id] });
      queryClient.invalidateQueries({ queryKey: ['cars-in-downtime'] });
      queryClient.invalidateQueries({ queryKey: ['attention-items'] });
      toast({
        title: 'Downtime ended',
        description: 'Car marked as back active.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
