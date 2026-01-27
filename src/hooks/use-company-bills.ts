import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CompanyBill } from '@/types/booking';

export function useCompanyBills(filters?: {
  bookingId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ['company-bills', filters],
    queryFn: async () => {
      let query = supabase
        .from('company_bills')
        .select(`
          *,
          bookings!inner(booking_ref, status, customer_name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.bookingId) {
        query = query.eq('booking_id', filters.bookingId);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as (CompanyBill & {
        bookings: { booking_ref: string; status: string; customer_name: string };
      })[];
    },
  });
}

export function useCompanyBill(id: string | undefined) {
  return useQuery({
    queryKey: ['company-bill', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('company_bills')
        .select(`
          *,
          bookings!inner(booking_ref, status, customer_name, customer_phone)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as CompanyBill & {
        bookings: { booking_ref: string; status: string; customer_name: string; customer_phone: string };
      };
    },
    enabled: !!id,
  });
}

export function useCreateCompanyBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      booking_id: string;
      customer_bill_id: string;
      bill_number: string;
      customer_name: string;
      customer_phone: string;
      start_at: string;
      end_at: string;
      pickup: string | null;
      dropoff: string | null;
      start_odometer_reading: number | null;
      end_odometer_reading: number | null;
      total_km_driven: number;
      km_calculation_method: 'odometer' | 'manual';
      vehicle_details: any[];
      total_amount: number;
      total_driver_allowance: number;
      advance_amount: number;
      advance_payment_method: 'cash' | 'online' | null;
      advance_account_type: 'company' | 'personal' | null;
      advance_account_id: string | null;
      advance_collected_by: string | null;
      transfer_requirements: any[];
      internal_notes: string | null;
      threshold_note: string | null;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { data: companyBill, error } = await supabase
        .from('company_bills')
        .insert({
          ...data,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return companyBill as CompanyBill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-bills'] });
    },
    onError: (error) => {
      toast.error(`Failed to create company bill: ${error.message}`);
    },
  });
}

export function useUploadCompanyBillPDF() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ billId, pdfFile }: { billId: string; pdfFile: File }) => {
      const filePath = `company-bills/${billId}/${pdfFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from('bills')
        .upload(filePath, pdfFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('company_bills')
        .update({
          pdf_file_path: filePath,
          pdf_file_name: pdfFile.name,
        })
        .eq('id', billId);

      if (updateError) throw updateError;

      return { filePath, fileName: pdfFile.name };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-bill', variables.billId] });
      queryClient.invalidateQueries({ queryKey: ['company-bills'] });
    },
    onError: (error) => {
      toast.error(`Failed to upload PDF: ${error.message}`);
    },
  });
}

export function useCompanyBillPDFUrl(billId: string | undefined, filePath: string | null) {
  return useQuery({
    queryKey: ['company-bill-pdf-url', billId, filePath],
    queryFn: async () => {
      if (!billId || !filePath) return null;

      const { data, error } = await supabase.storage
        .from('bills')
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!billId && !!filePath,
  });
}
