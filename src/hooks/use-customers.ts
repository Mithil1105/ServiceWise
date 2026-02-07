import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useSearchCustomers(search: string) {
  return useQuery({
    queryKey: ['customers', 'search', search],
    queryFn: async () => {
      if (!search.trim()) return [];
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
        .limit(10);
      
      if (error) throw error;
      return data as Customer[];
    },
    enabled: search.length >= 2,
  });
}

export function useUpsertCustomer() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ name, phone }: { name: string; phone: string }) => {
      const orgId = profile?.organization_id;
      if (!orgId) throw new Error('Organization not found');
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('organization_id', orgId)
        .eq('phone', phone)
        .maybeSingle();
      
      if (existing) {
        const { error } = await supabase
          .from('customers')
          .update({ name })
          .eq('phone', phone)
          .eq('organization_id', orgId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .insert({ organization_id: orgId, name, phone });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
