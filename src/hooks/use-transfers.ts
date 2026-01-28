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
  return useQuery({
    queryKey: ['pending-transfers'],
    queryFn: async () => {
      // First, try to get transfers from transfers table
      const { data: transfersData, error: transfersError } = await supabase
        .from('transfers')
        .select(`
          *,
          bookings!inner(booking_ref, customer_name, customer_phone),
          bills(bill_number, created_at)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // Also get transfer requirements from company_bills
      const { data: companyBillsData, error: companyBillsError } = await supabase
        .from('company_bills')
        .select(`
          *,
          bookings(booking_ref, customer_name, customer_phone),
          bills(bill_number, created_at, id)
        `)
        .not('transfer_requirements', 'is', null);

      if (transfersError) throw transfersError;
      if (companyBillsError) throw companyBillsError;

      // Combine transfers from transfers table
      const transfers: any[] = (transfersData || []).map(t => ({
        ...t,
        bills: t.bills || null,
      }));

      // Extract pending transfers from company_bills transfer_requirements
      (companyBillsData || []).forEach((bill: any) => {
        if (bill.transfer_requirements && Array.isArray(bill.transfer_requirements)) {
          bill.transfer_requirements.forEach((req: any, index: number) => {
            if (req.status === 'pending') {
              transfers.push({
                id: `cb::${bill.id}::${index}`, // Use :: separator to avoid UUID parsing issues
                booking_id: bill.booking_id,
                bill_id: bill.customer_bill_id || bill.bills?.id,
                amount: req.amount,
                from_account_type: req.from_account_type,
                from_account_id: req.from_account_id || null,
                collected_by_name: req.collected_by_name || bill.advance_collected_by || 'Unknown',
                status: 'pending',
                created_at: bill.created_at,
                bookings: bill.bookings,
                bills: bill.bills || { bill_number: bill.bill_number, created_at: bill.created_at },
                _source: 'company_bills', // Mark as coming from company_bills
                _company_bill_id: bill.id,
                _transfer_index: index,
              });
            }
          });
        }
      });

      return transfers;
    },
  });
}

export function useCompletedTransfers(filters?: {
  collectedByUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ['completed-transfers', filters],
    queryFn: async () => {
      // First, try to get transfers from transfers table
      let query = supabase
        .from('transfers')
        .select(`
          *,
          bookings!inner(booking_ref, customer_name, customer_phone),
          bills(bill_number, created_at)
        `)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (filters?.collectedByUserId) {
        query = query.eq('collected_by_user_id', filters.collectedByUserId);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data: transfersData, error: transfersError } = await query;

      // Also get transfer requirements from company_bills
      let companyBillsQuery = supabase
        .from('company_bills')
        .select(`
          *,
          bookings(booking_ref, customer_name, customer_phone),
          bills(bill_number, created_at, id)
        `)
        .not('transfer_requirements', 'is', null);

      if (filters?.dateFrom) {
        companyBillsQuery = companyBillsQuery.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        companyBillsQuery = companyBillsQuery.lte('created_at', filters.dateTo);
      }

      const { data: companyBillsData, error: companyBillsError } = await companyBillsQuery;

      if (transfersError) throw transfersError;
      if (companyBillsError) throw companyBillsError;

      // Extract completed transfers from company_bills transfer_requirements first to get all user IDs
      const companyBillTransfers: any[] = [];
      (companyBillsData || []).forEach((bill: any) => {
        if (bill.transfer_requirements && Array.isArray(bill.transfer_requirements)) {
          bill.transfer_requirements.forEach((req: any, index: number) => {
            if (req.status === 'completed') {
              // Apply date filters if specified
              const transferDate = req.transfer_date || req.completed_at || bill.created_at;
              if (filters?.dateFrom && transferDate < filters.dateFrom) return;
              if (filters?.dateTo && transferDate > filters.dateTo) return;

              companyBillTransfers.push({
                id: `cb::${bill.id}::${index}`,
                booking_id: bill.booking_id,
                bill_id: bill.customer_bill_id || bill.bills?.id,
                amount: req.amount,
                from_account_type: req.from_account_type,
                from_account_id: req.from_account_id || null,
                collected_by_name: req.collected_by_name || bill.advance_collected_by || 'Unknown',
                status: 'completed',
                transfer_date: req.transfer_date || req.completed_at || null,
                completed_at: req.completed_at || transferDate,
                completed_by_user_id: req.completed_by_user_id || null,
                cashier_name: req.cashier_name || null,
                notes: req.notes || null,
                created_at: bill.created_at,
                bookings: bill.bookings,
                bills: bill.bills || { bill_number: bill.bill_number, created_at: bill.created_at },
                _source: 'company_bills',
                _company_bill_id: bill.id,
                _transfer_index: index,
              });
            }
          });
        }
      });

      // Fetch user profiles for completed_by_user_id and collected_by_user_id from both sources
      const userIds = [...new Set([
        ...(transfersData || []).map(t => t.completed_by_user_id).filter(Boolean),
        ...(transfersData || []).map(t => t.collected_by_user_id).filter(Boolean),
        ...companyBillTransfers.map(t => t.completed_by_user_id).filter(Boolean),
      ])];
      
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map(p => [p.id, p.name]));
        }
      }

      // Combine transfers from transfers table
      const transfers: any[] = (transfersData || []).map(t => ({
        ...t,
        bills: t.bills || null,
        completed_by_name: t.completed_by_user_id ? profileMap[t.completed_by_user_id] || null : null,
        collected_by_name: t.collected_by_name || (t.collected_by_user_id ? profileMap[t.collected_by_user_id] || null : null),
      }));

      // Add company bill transfers with profile names
      companyBillTransfers.forEach(t => {
        transfers.push({
          ...t,
          completed_by_name: t.completed_by_user_id ? profileMap[t.completed_by_user_id] || null : null,
        });
      });

      // Sort by transfer_date or completed_at descending (most recent first)
      return transfers.sort((a, b) => {
        const dateA = a.transfer_date || a.completed_at || a.created_at;
        const dateB = b.transfer_date || b.completed_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    },
  });
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

      // Check if this is a transfer from company_bills (starts with 'cb::')
      if (data.transfer_id.startsWith('cb::')) {
        // Extract company bill ID and transfer index from the ID
        // Format: cb::{company_bill_id}::{index}
        const parts = data.transfer_id.split('::');
        const companyBillId = parts[1]; // Full UUID
        const transferIndex = parseInt(parts[2]) || 0;

        // Get the company bill with all necessary data
        const { data: companyBill, error: fetchError } = await supabase
          .from('company_bills')
          .select('transfer_requirements, booking_id, customer_bill_id')
          .eq('id', companyBillId)
          .single();

        if (fetchError) throw fetchError;

        // Update the transfer requirement status
        const transferRequirements = companyBill.transfer_requirements || [];
        if (transferRequirements[transferIndex]) {
          const transferReq = transferRequirements[transferIndex];
          
          // Update the transfer requirement with completion details
          transferRequirements[transferIndex] = {
            ...transferReq,
            status: 'completed',
            transfer_date: data.transfer_date,
            cashier_name: data.cashier_name || transferReq.cashier_name || null,
            notes: data.notes || transferReq.notes || null,
            completed_at: new Date().toISOString(),
            completed_by_user_id: userId || null,
          };

          // Update the company bill with updated transfer_requirements
          const { error: updateError } = await supabase
            .from('company_bills')
            .update({ 
              transfer_requirements: transferRequirements,
              updated_at: new Date().toISOString()
            })
            .eq('id', companyBillId);

          if (updateError) throw updateError;

          // Also create a record in transfers table for tracking and history
          const { error: insertError } = await supabase
            .from('transfers')
            .insert({
              booking_id: companyBill.booking_id,
              bill_id: companyBill.customer_bill_id,
              amount: transferReq.amount,
              from_account_type: transferReq.from_account_type,
              from_account_id: transferReq.from_account_id || null,
              collected_by_name: transferReq.collected_by_name || 'Unknown',
              status: 'completed',
              transfer_date: data.transfer_date,
              completed_by_user_id: userId,
              completed_at: new Date().toISOString(),
              cashier_name: data.cashier_name || null,
              notes: data.notes || null,
            });

          // Don't throw error if insert fails - the company bill update is more important
          if (insertError) {
            console.warn('Failed to create transfer record:', insertError);
          }

          return { 
            id: data.transfer_id, 
            status: 'completed',
            transfer_date: data.transfer_date,
            completed_at: new Date().toISOString(),
          } as Transfer;
        } else {
          throw new Error('Transfer requirement not found');
        }
      } else {
        // Regular transfer from transfers table
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
      }
    },
    onSuccess: () => {
      // Invalidate all related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['pending-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['completed-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfers-needing-reminder'] });
      queryClient.invalidateQueries({ queryKey: ['company-bills'] });
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
