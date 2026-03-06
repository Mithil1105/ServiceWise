import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ChallanType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/hooks/use-org';

export function useChallanTypes() {
  const { orgId } = useOrg();

  return useQuery({
    queryKey: ['challan-types', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('challan_types')
        .select('*')
        .eq('organization_id', orgId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChallanType[];
    },
    enabled: !!orgId,
  });
}

export function useCreateChallanType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { orgId } = useOrg();

  return useMutation({
    mutationFn: async (payload: { name: string; sort_order?: number }) => {
      if (!orgId) throw new Error('Organization not found');
      const { data, error } = await supabase
        .from('challan_types')
        .insert({
          organization_id: orgId,
          name: payload.name.trim(),
          sort_order: payload.sort_order ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ChallanType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challan-types'] });
      toast.success('Challan type added');
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Failed to add challan type');
    },
  });
}

export function useDeleteChallanType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('challan_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challan-types'] });
      toast.success('Challan type removed');
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Failed to remove challan type');
    },
  });
}
