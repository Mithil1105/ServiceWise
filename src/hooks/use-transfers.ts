import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Transfer } from '@/types/booking';

export function useTransfers(filters?: {
  status?: 'pending' | 'completed';
  collectedByUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ['transfers', filters],
    queryFn: async () => {
      let query = supabase
        .from('transfers')
        .select(`
          *,
          bookings!inner(booking_ref, customer_name, customer_phone),
          bills(bill_number, created_at)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.collectedByUserId) {
        query = query.eq('collected_by_user_id', filters.collectedByUserId);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as (Transfer & {
        bookings: { booking_ref: string; customer_name: string; customer_phone: string };
        bills: { bill_number: string; created_at: string } | null;
      })[];
    },
  });
}

export function usePendingTransfers() {
  return useTransfers({ status: 'pending' });
}

export function useCompletedTransfers(filters?: {
  collectedByUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useTransfers({ ...filters, status: 'completed' });
}

export function useTransfersNeedingReminder() {
  return useQuery({
    queryKey: ['transfers-needing-reminder'],
    queryFn: async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const { data, error } = await supabase
        .from('transfers')
        .select(`
          *,
          bookings!inner(booking_ref, customer_name),
          bills(bill_number, created_at)
        `)
        .eq('status', 'pending')
        .is('reminder_sent_at', null)
        .gte('created_at', fiveDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as (Transfer & {
        bookings: { booking_ref: string; customer_name: string };
        bills: { bill_number: string; created_at: string } | null;
      })[];
    },
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      booking_id: string;
      bill_id?: string;
      amount: number;
      from_account_type: 'personal' | 'cash';
      from_account_id?: string | null;
      collected_by_user_id: string;
      collected_by_name: string;
      status?: 'pending' | 'completed';
      cash_given_to_cashier?: boolean;
      cashier_name?: string | null;
      notes?: string | null;
    }) => {
      const { data: transfer, error } = await supabase
        .from('transfers')
        .insert({
          booking_id: data.booking_id,
          bill_id: data.bill_id || null,
          amount: data.amount,
          from_account_type: data.from_account_type,
          from_account_id: data.from_account_id || null,
          collected_by_user_id: data.collected_by_user_id,
          collected_by_name: data.collected_by_name,
          status: data.status || 'pending',
          cash_given_to_cashier: data.cash_given_to_cashier || false,
          cashier_name: data.cashier_name || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return transfer as Transfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfers-needing-reminder'] });
    },
    onError: (error) => {
      toast.error(`Failed to create transfer: ${error.message}`);
    },
  });
}

export function useCompleteTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      transfer_id: string;
      transfer_date: string;
      cashier_name?: string | null;
      notes?: string | null;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { data: transfer, error } = await supabase
        .from('transfers')
        .update({
          status: 'completed',
          transfer_date: data.transfer_date,
          completed_by_user_id: userId,
          completed_at: new Date().toISOString(),
          cashier_name: data.cashier_name || null,
          notes: data.notes || null,
        })
        .eq('id', data.transfer_id)
        .select()
        .single();

      if (error) throw error;
      return transfer as Transfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfers-needing-reminder'] });
      toast.success('Transfer marked as completed');
    },
    onError: (error) => {
      toast.error(`Failed to complete transfer: ${error.message}`);
    },
  });
}

export function useMarkReminderSent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transferId: string) => {
      const { error } = await supabase
        .from('transfers')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', transferId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers-needing-reminder'] });
    },
  });
}
