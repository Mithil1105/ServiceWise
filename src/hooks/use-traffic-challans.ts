import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TrafficChallan } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/hooks/use-org';

export interface DriverAtTime {
  driver_name: string | null;
  driver_phone: string | null;
}

export function useDriverForCarAtTime(carId: string | null, incidentAt: string | null) {
  const enabled = !!carId && !!incidentAt;
  return useQuery({
    queryKey: ['driver-for-car-at-time', carId, incidentAt],
    queryFn: async (): Promise<DriverAtTime> => {
      if (!carId || !incidentAt) return { driver_name: null, driver_phone: null };

      // Frontend fallback instead of RPC (avoid 400 errors and still use bookings data):
      // 1) Get the most recent booking_vehicles row for this car, joined with bookings.
      // 2) Prefer bookings that ended at/after the incident time; otherwise fall back to latest overall.
      const incidentIso = new Date(incidentAt).toISOString();

      const { data, error } = await supabase
        .from('booking_vehicles')
        .select('driver_name, driver_phone, bookings!inner(start_at, end_at, status)')
        .eq('car_id', carId)
        .order('end_at', { foreignTable: 'bookings', ascending: false });

      if (error) {
        console.error('get_driver_for_car_at_time fallback error', error);
        return { driver_name: null, driver_phone: null };
      }

      const rows = (data as any[]) || [];
      if (rows.length === 0) {
        return { driver_name: null, driver_phone: null };
      }

      // Prefer booking active around the incident time
      const primary = rows.find((row) => {
        const b = row.bookings as { start_at: string; end_at: string; status: string } | undefined;
        if (!b) return false;
        const start = new Date(b.start_at).toISOString();
        const end = new Date(b.end_at).toISOString();
        return start <= incidentIso && end >= incidentIso && ['confirmed', 'ongoing'].includes(b.status);
      });

      const row = primary ?? rows[0];
      return {
        driver_name: row?.driver_name ?? null,
        driver_phone: row?.driver_phone ?? null,
      };
    },
    enabled,
  });
}

export function useCreateTrafficChallan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { orgId } = useOrg();

  return useMutation({
    mutationFn: async (payload: {
      incident_id: string | null;
      car_id: string;
      driver_name: string | null;
      driver_phone: string | null;
      challan_type_id: string | null;
      amount: number;
      incident_at: string;
      location?: string | null;
      description?: string | null;
    }) => {
      if (!orgId) throw new Error('Organization not found');
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('traffic_challans')
        .insert({
          organization_id: orgId,
          incident_id: payload.incident_id ?? null,
          car_id: payload.car_id,
          driver_name: payload.driver_name ?? null,
          driver_phone: payload.driver_phone ?? null,
          challan_type_id: payload.challan_type_id ?? null,
          amount: payload.amount,
          incident_at: payload.incident_at,
          location: payload.location ?? null,
          description: payload.description ?? null,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as TrafficChallan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['traffic-challans'] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Failed to save traffic challan');
    },
  });
}

export function useTrafficChallans(filters?: { startDate?: string; endDate?: string }) {
  const { orgId } = useOrg();

  return useQuery({
    queryKey: ['traffic-challans', orgId, filters],
    queryFn: async () => {
      if (!orgId) return [];
      let query = supabase
        .from('traffic_challans')
        .select('*, challan_types(name), cars(vehicle_number, model)')
        .eq('organization_id', orgId)
        .order('incident_at', { ascending: false });
      if (filters?.startDate) {
        query = query.gte('incident_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('incident_at', filters.endDate);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as (TrafficChallan & { challan_types: { name: string } | null; cars: { vehicle_number: string; model: string } | null })[];
    },
    enabled: !!orgId,
  });
}
