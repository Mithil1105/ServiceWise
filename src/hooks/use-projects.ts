import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProjectPoolCar {
  car_id: string;
  vehicle_number: string;
  model: string;
  brand: string | null;
  car_project_scope: 'open' | 'mine_private' | 'private' | 'other';
  car_project_id: string | null;
  car_project_name: string | null;
  car_project_type: 'open' | 'private' | null;
}

export interface ProjectPoolOverview {
  open_project_id: string;
  open_project_name: string;
  open_supervisor_id: string | null;
  open_supervisor_name: string | null;
  my_project_ids: string[];
  my_project_names: string[];
  my_private_project_id?: string | null;
  my_private_project_name?: string | null;
  cars: ProjectPoolCar[];
}

export interface ProjectsAdminRow {
  project_id: string;
  project_name: string;
  project_type: 'open' | 'private';
  supervisor_id: string | null;
  supervisor_name: string | null;
  car_count: number;
}

export function useProjectPoolOverview() {
  return useQuery({
    queryKey: ['project-pool-overview'],
    queryFn: async (): Promise<ProjectPoolOverview | null> => {
      const { data, error } = await (supabase as any).rpc('get_project_pool_overview');
      if (error) throw error;
      const rows = (data ?? []) as any[];
      if (!rows.length) return null;
      const fallbackPrivateId = rows[0].my_private_project_id ?? null;
      const fallbackPrivateName = rows[0].my_private_project_name ?? null;
      const parsedProjectIds = Array.isArray(rows[0].my_project_ids)
        ? rows[0].my_project_ids
        : (fallbackPrivateId ? [fallbackPrivateId] : []);
      const parsedProjectNames = Array.isArray(rows[0].my_project_names)
        ? rows[0].my_project_names
        : (fallbackPrivateName ? [fallbackPrivateName] : []);

      return {
        open_project_id: rows[0].open_project_id,
        open_project_name: rows[0].open_project_name,
        open_supervisor_id: rows[0].open_supervisor_id,
        open_supervisor_name: rows[0].open_supervisor_name,
        my_project_ids: parsedProjectIds,
        my_project_names: parsedProjectNames,
        my_private_project_id: fallbackPrivateId,
        my_private_project_name: fallbackPrivateName,
        cars: rows.map((r) => ({
          car_id: r.car_id,
          vehicle_number: r.vehicle_number,
          model: r.model,
          brand: r.brand ?? null,
          car_project_scope: r.car_project_scope,
          car_project_id:
            r.car_project_id
            ?? (r.car_project_scope === 'private' && fallbackPrivateId ? fallbackPrivateId : null),
          car_project_name:
            r.car_project_name
            ?? (r.car_project_scope === 'private' && fallbackPrivateName ? fallbackPrivateName : null),
          car_project_type:
            r.car_project_type
            ?? (r.car_project_scope === 'open' ? 'open' : r.car_project_scope === 'private' ? 'private' : null),
        })),
      };
    },
  });
}

export function useProjectsAdminOverview() {
  return useQuery({
    queryKey: ['projects-admin-overview'],
    queryFn: async (): Promise<ProjectsAdminRow[]> => {
      const { data, error } = await (supabase as any).rpc('get_projects_admin_overview');
      if (error) throw error;
      return (data ?? []) as ProjectsAdminRow[];
    },
  });
}

export function useOpenBookingAccess() {
  return useQuery({
    queryKey: ['open-booking-access'],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await (supabase as any).rpc('is_open_project_supervisor');
      if (error) throw error;
      return !!data;
    },
  });
}

export function useMyAccessibleCarIds() {
  return useQuery({
    queryKey: ['my-accessible-car-ids'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any).rpc('get_my_accessible_car_ids');
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });
}

export function useTransferCarToProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ carId, targetProjectId, notes }: { carId: string; targetProjectId: string; notes?: string }) => {
      const { data, error } = await (supabase as any).rpc('transfer_car_to_project', {
        p_car_id: carId,
        p_target_project_id: targetProjectId,
        p_notes: notes ?? null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Transfer failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      queryClient.invalidateQueries({ queryKey: ['project-pool-overview'] });
      queryClient.invalidateQueries({ queryKey: ['projects-admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['my-accessible-car-ids'] });
      queryClient.invalidateQueries({ queryKey: ['available-cars'] });
      toast.success('Car moved successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to move car');
    },
  });
}

export function useSetOpenProjectSupervisor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ supervisorId }: { supervisorId: string }) => {
      const { data, error } = await (supabase as any).rpc('set_open_project_supervisor', {
        p_supervisor_id: supervisorId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Update failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects-admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['project-pool-overview'] });
      queryClient.invalidateQueries({ queryKey: ['open-booking-access'] });
      toast.success('Open project supervisor updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update open supervisor');
    },
  });
}

export function useEnsurePrivateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ supervisorId, name }: { supervisorId: string; name?: string }) => {
      const { data, error } = await (supabase as any).rpc('ensure_private_project_for_supervisor', {
        p_supervisor_id: supervisorId,
        p_name: name ?? null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to ensure project');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects-admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['project-pool-overview'] });
      toast.success('Project ensured');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to ensure project');
    },
  });
}
