import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type DocumentType = 'rc' | 'puc' | 'insurance' | 'warranty';

export interface CarDocument {
  id: string;
  car_id: string;
  document_type: DocumentType;
  expiry_date: string | null;
  file_path: string | null;
  file_name: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useCarDocuments(carId: string) {
  return useQuery({
    queryKey: ['car-documents', carId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('car_documents')
        .select('*')
        .eq('car_id', carId)
        .order('document_type');
      
      if (error) throw error;
      return data as CarDocument[];
    },
    enabled: !!carId,
  });
}

export function useExpiringDocuments(daysAhead: number = 30) {
  return useQuery({
    queryKey: ['expiring-documents', daysAhead],
    queryFn: async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      
      const { data, error } = await supabase
        .from('car_documents')
        .select(`
          *,
          cars:car_id (id, vehicle_number, model)
        `)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', futureDate.toISOString().split('T')[0])
        .order('expiry_date');
      
      if (error) throw error;
      return data as (CarDocument & { cars: { id: string; vehicle_number: string; model: string } })[];
    },
  });
}

export function useExpiringDriverLicenses(daysAhead: number = 30) {
  return useQuery({
    queryKey: ['expiring-licenses', daysAhead],
    queryFn: async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .not('license_expiry', 'is', null)
        .lte('license_expiry', futureDate.toISOString().split('T')[0])
        .eq('status', 'active')
        .order('license_expiry');
      
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertCarDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      carId,
      documentType,
      expiryDate,
      notes,
      file,
    }: {
      carId: string;
      documentType: DocumentType;
      expiryDate?: string | null;
      notes?: string | null;
      file?: File;
    }) => {
      let file_path: string | null = null;
      let file_name: string | null = null;

      // Upload file if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${carId}/${documentType}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('car-documents')
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        file_path = fileName;
        file_name = file.name;
      }

      const { data, error } = await supabase
        .from('car_documents')
        .upsert({
          car_id: carId,
          document_type: documentType,
          expiry_date: expiryDate || null,
          file_path: file_path || undefined,
          file_name: file_name || undefined,
          notes: notes || null,
        }, {
          onConflict: 'car_id,document_type',
        })
        .select()
        .single();

      if (error) throw error;
      return data as CarDocument;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['car-documents', variables.carId] });
      queryClient.invalidateQueries({ queryKey: ['expiring-documents'] });
      toast.success('Document saved successfully');
    },
    onError: (error) => {
      toast.error('Failed to save document', { description: error.message });
    },
  });
}

export function useDeleteCarDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, carId }: { id: string; carId: string }) => {
      const { error } = await supabase.from('car_documents').delete().eq('id', id);
      if (error) throw error;
      return carId;
    },
    onSuccess: (carId) => {
      queryClient.invalidateQueries({ queryKey: ['car-documents', carId] });
      queryClient.invalidateQueries({ queryKey: ['expiring-documents'] });
      toast.success('Document deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete document', { description: error.message });
    },
  });
}

export function useDocumentDownloadUrl(filePath: string | null) {
  return useQuery({
    queryKey: ['car-document-url', filePath],
    queryFn: async () => {
      if (!filePath) return null;
      
      const { data, error } = await supabase.storage
        .from('car-documents')
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!filePath,
  });
}
