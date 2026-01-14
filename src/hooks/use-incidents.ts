import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Incident } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useIncidents(filters?: {
  carId?: string;
  unresolvedOnly?: boolean;
  severity?: Incident['severity'];
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ['incidents', filters],
    queryFn: async () => {
      let query = supabase
        .from('incidents')
        .select('*, cars(vehicle_number, model)')
        .order('incident_at', { ascending: false });
      
      if (filters?.carId) {
        query = query.eq('car_id', filters.carId);
      }
      if (filters?.unresolvedOnly) {
        query = query.eq('resolved', false);
      }
      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.startDate) {
        query = query.gte('incident_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('incident_at', filters.endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch profile names for created_by
      const userIds = [...new Set(data?.map(i => i.created_by).filter(Boolean) || [])];
      let profileMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        
        profileMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {});
      }
      
      return (data || []).map(incident => ({
        ...incident,
        profiles: incident.created_by ? { name: profileMap[incident.created_by] || 'Unknown' } : null,
      })) as (Incident & { 
        cars: { vehicle_number: string; model: string };
        profiles: { name: string } | null;
      })[];
    },
  });
}

export function useUnresolvedIncidentsCount() {
  return useQuery({
    queryKey: ['unresolved-incidents-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false);
      
      if (error) throw error;
      return count || 0;
    },
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (incident: {
      car_id: string;
      incident_at?: string;
      estimated_return_at?: string;
      type: Incident['type'];
      severity?: Incident['severity'];
      description?: string;
      location?: string;
      cost?: number;
      driver_name?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create incident
      const { data, error } = await supabase
        .from('incidents')
        .insert({
          ...incident,
          incident_at: incident.incident_at || new Date().toISOString(),
          severity: incident.severity || 'medium',
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Auto-create downtime log for the incident
      const { error: downtimeError } = await supabase
        .from('downtime_logs')
        .insert({
          car_id: incident.car_id,
          reason: incident.type === 'accident' ? 'accident' : 'breakdown',
          notes: `Incident: ${incident.type}${incident.description ? ' - ' + incident.description : ''}`,
          started_at: incident.incident_at || new Date().toISOString(),
          estimated_uptime_at: incident.estimated_return_at || null,
          source: 'system',
          created_by: user?.id,
        });
      
      if (downtimeError) {
        console.error('Failed to create downtime log:', downtimeError);
      }
      
      return data as Incident;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['unresolved-incidents-count'] });
      queryClient.invalidateQueries({ queryKey: ['attention-items'] });
      queryClient.invalidateQueries({ queryKey: ['downtime-logs'] });
      queryClient.invalidateQueries({ queryKey: ['cars-in-downtime'] });
      toast({
        title: 'Incident logged',
        description: 'Incident has been recorded and car marked as down.',
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

export function useResolveIncident() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { id: string; resolved_notes?: string; resolved_at?: string }) => {
      // Get incident to find car_id
      const { data: incident, error: fetchError } = await supabase
        .from('incidents')
        .select('car_id, incident_at')
        .eq('id', params.id)
        .single();
      
      if (fetchError) throw fetchError;

      const resolvedAt = params.resolved_at || new Date().toISOString();

      // Resolve the incident
      const { data, error } = await supabase
        .from('incidents')
        .update({
          resolved: true,
          resolved_at: resolvedAt,
          resolved_notes: params.resolved_notes,
        })
        .eq('id', params.id)
        .select()
        .single();
      
      if (error) throw error;

      // End any active downtime for this car that started around the incident time
      const { data: activeDowntime } = await supabase
        .from('downtime_logs')
        .select('id')
        .eq('car_id', incident.car_id)
        .is('ended_at', null)
        .eq('source', 'system')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeDowntime) {
        await supabase
          .from('downtime_logs')
          .update({ ended_at: resolvedAt })
          .eq('id', activeDowntime.id);
      }
      
      return data as Incident;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['unresolved-incidents-count'] });
      queryClient.invalidateQueries({ queryKey: ['attention-items'] });
      queryClient.invalidateQueries({ queryKey: ['downtime-logs'] });
      queryClient.invalidateQueries({ queryKey: ['cars-in-downtime'] });
      toast({
        title: 'Incident resolved',
        description: 'Incident marked as resolved and car back on road.',
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
