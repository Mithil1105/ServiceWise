import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CarNote } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/hooks/use-org';

export function useCarNotes(carId: string) {
  return useQuery({
    queryKey: ['car-notes', carId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('car_notes')
        .select('*')
        .eq('car_id', carId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CarNote[];
    },
    enabled: !!carId,
  });
}

export function useCreateCarNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { orgId } = useOrg();

  return useMutation({
    mutationFn: async (params: {
      car_id: string;
      note: string;
      pinned?: boolean;
    }) => {
      if (!orgId) throw new Error('Organization not found');
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('car_notes')
        .insert({
          organization_id: orgId,
          car_id: params.car_id,
          note: params.note,
          pinned: params.pinned || false,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as CarNote;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['car-notes', variables.car_id] });
      toast({
        title: 'Note added',
        description: 'Note has been saved.',
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

export function useDeleteCarNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { id: string; car_id: string }) => {
      const { error } = await supabase
        .from('car_notes')
        .delete()
        .eq('id', params.id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['car-notes', variables.car_id] });
      toast({
        title: 'Note deleted',
        description: 'Note has been removed.',
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

export function useTogglePinNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; car_id: string; pinned: boolean }) => {
      const { data, error } = await supabase
        .from('car_notes')
        .update({ pinned: params.pinned })
        .eq('id', params.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as CarNote;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['car-notes', variables.car_id] });
    },
  });
}
