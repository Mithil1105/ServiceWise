import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CarAssignment {
  id: string;
  car_id: string;
  supervisor_id: string;
  assigned_at: string;
  assigned_by: string | null;
  notes: string | null;
}

export interface CarAssignmentWithDetails extends CarAssignment {
  cars: {
    id: string;
    vehicle_number: string;
    model: string;
  };
  supervisor?: {
    id: string;
    name: string;
  };
}

// Get all car assignments (for admin view)
export function useCarAssignments() {
  return useQuery({
    queryKey: ['car-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('car_assignments')
        .select(`
          *,
          cars:car_id (id, vehicle_number, model)
        `)
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      // Fetch supervisor profiles separately
      const supervisorIds = [...new Set(data.map((a) => a.supervisor_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', supervisorIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return data.map((a) => ({
        ...a,
        supervisor: profileMap.get(a.supervisor_id),
      })) as CarAssignmentWithDetails[];
    },
  });
}

// Get assignments for a specific supervisor
export function useSupervisorAssignments(supervisorId: string | undefined) {
  return useQuery({
    queryKey: ['supervisor-assignments', supervisorId],
    queryFn: async () => {
      if (!supervisorId) return [];

      const { data, error } = await supabase
        .from('car_assignments')
        .select(`
          *,
          cars:car_id (id, vehicle_number, model)
        `)
        .eq('supervisor_id', supervisorId)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data as CarAssignmentWithDetails[];
    },
    enabled: !!supervisorId,
  });
}

// Get assignments for a specific car
export function useCarAssignmentsByCar(carId: string) {
  return useQuery({
    queryKey: ['car-assignments-by-car', carId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('car_assignments')
        .select('*')
        .eq('car_id', carId);

      if (error) throw error;

      // Fetch supervisor profiles
      if (data.length > 0) {
        const supervisorIds = data.map((a) => a.supervisor_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', supervisorIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        return data.map((a) => ({
          ...a,
          supervisor: profileMap.get(a.supervisor_id),
        }));
      }

      return data;
    },
    enabled: !!carId,
  });
}

// Get all supervisors for dropdown
export function useSupervisors() {
  return useQuery({
    queryKey: ['supervisors'],
    queryFn: async () => {
      // Get all users with supervisor role
      const { data: supervisorRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'supervisor');

      if (rolesError) throw rolesError;

      if (!supervisorRoles.length) return [];

      const supervisorIds = supervisorRoles.map((r) => r.user_id);

      // Get their profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', supervisorIds);

      if (profilesError) throw profilesError;
      return profiles || [];
    },
  });
}

// Assign car to supervisor
export function useAssignCarToSupervisor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      carId,
      supervisorId,
      notes,
    }: {
      carId: string;
      supervisorId: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('car_assignments')
        .insert({
          car_id: carId,
          supervisor_id: supervisorId,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['supervisor-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['car-assignments-by-car'] });
      toast.success('Car assigned to supervisor');
    },
    onError: (error) => {
      toast.error('Failed to assign car', { description: error.message });
    },
  });
}

// Unassign car from supervisor
export function useUnassignCarFromSupervisor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('car_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['car-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['supervisor-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['car-assignments-by-car'] });
      toast.success('Car unassigned from supervisor');
    },
    onError: (error) => {
      toast.error('Failed to unassign car', { description: error.message });
    },
  });
}
