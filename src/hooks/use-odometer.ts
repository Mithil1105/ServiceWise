import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OdometerEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useOdometerEntries(carId?: string) {
  return useQuery({
    queryKey: ['odometer-entries', carId],
    queryFn: async () => {
      let query = supabase
        .from('odometer_entries')
        .select('*')
        .order('reading_at', { ascending: false });
      
      if (carId) {
        query = query.eq('car_id', carId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as OdometerEntry[];
    },
  });
}

export function useLatestOdometer(carId: string) {
  return useQuery({
    queryKey: ['latest-odometer', carId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('odometer_entries')
        .select('*')
        .eq('car_id', carId)
        .order('reading_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as OdometerEntry | null;
    },
    enabled: !!carId,
  });
}

export function useCreateOdometerEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (entry: {
      car_id: string;
      odometer_km: number;
      reading_at?: string;
    }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if new reading is valid (must be >= last reading)
      const { data: lastEntry } = await supabase
        .from('odometer_entries')
        .select('odometer_km')
        .eq('car_id', entry.car_id)
        .order('reading_at', { ascending: false })
        .limit(1)
        .single();

      if (lastEntry && entry.odometer_km < lastEntry.odometer_km) {
        throw new Error(`Odometer reading cannot be less than the last reading (${lastEntry.odometer_km} km)`);
      }

      const { data, error } = await supabase
        .from('odometer_entries')
        .insert({
          car_id: entry.car_id,
          odometer_km: entry.odometer_km,
          reading_at: entry.reading_at || new Date().toISOString(),
          entered_by: user?.id,
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
          supervisor_id: user?.id,
          car_id: entry.car_id,
          action_type: 'odometer_updated',
          action_details: {
            odometer_km: entry.odometer_km,
            reading_at: entry.reading_at || new Date().toISOString(),
          },
        });
      }

      return data as OdometerEntry;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['odometer-entries'] });
      queryClient.invalidateQueries({ queryKey: ['latest-odometer', variables.car_id] });
      queryClient.invalidateQueries({ queryKey: ['cars-with-status'] });
      queryClient.invalidateQueries({ queryKey: ['critical-services'] });
      queryClient.invalidateQueries({ queryKey: ['supervisor-activity'] });
      toast({
        title: 'Odometer updated',
        description: 'Odometer reading has been recorded.',
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
