import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BankAccount {
  id: string;
  account_name: string;
  account_number: string | null;
  bank_name: string | null;
  ifsc_code: string | null;
  account_type: 'company' | 'personal';
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useBankAccounts(accountType?: 'company' | 'personal') {
  return useQuery({
    queryKey: ['bank-accounts', accountType],
    queryFn: async () => {
      let query = supabase
        .from('bank_accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_name', { ascending: true });
      
      if (accountType) {
        query = query.eq('account_type', accountType);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as BankAccount[];
    },
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      account_name: string;
      account_number?: string | null;
      bank_name?: string | null;
      ifsc_code?: string | null;
      account_type: 'company' | 'personal';
      notes?: string | null;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { data: account, error } = await supabase
        .from('bank_accounts')
        .insert({
          account_name: data.account_name,
          account_number: data.account_number || null,
          bank_name: data.bank_name || null,
          ifsc_code: data.ifsc_code || null,
          account_type: data.account_type,
          notes: data.notes || null,
          is_active: true,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return account as BankAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Bank account created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create bank account: ${error.message}`);
    },
  });
}
