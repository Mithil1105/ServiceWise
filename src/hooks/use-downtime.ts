import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DowntimeLog } from '@/types';
import { useToast } from '@/hooks/use-toast';

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

  return useMutation({
    mutationFn: async (params: {
      car_id: string;
      reason: DowntimeLog['reason'];
      notes?: string;
      estimated_uptime_at?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('downtime_logs')
        .insert({
          car_id: params.car_id,
          reason: params.reason,
          notes: params.notes,
          estimated_uptime_at: params.estimated_uptime_at,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as DowntimeLog;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['downtime-logs'] });
      queryClient.invalidateQueries({ queryKey: ['active-downtime', variables.car_id] });
      queryClient.invalidateQueries({ queryKey: ['cars-in-downtime'] });
      queryClient.invalidateQueries({ queryKey: ['attention-items'] });
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

  return useMutation({
    mutationFn: async (downtimeId: string) => {
      const { data, error } = await supabase
        .from('downtime_logs')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', downtimeId)
        .select()
        .single();
      
      if (error) throw error;
      return data as DowntimeLog;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['downtime-logs'] });
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
