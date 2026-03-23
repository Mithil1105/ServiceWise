import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrg } from '@/hooks/use-org';
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from '@/lib/document-upload';
import { storageUpload, storageRemove, storageGetSignedUrl } from '@/lib/storage';
import { carDocumentKey, toFullKey } from '@/lib/storage-keys';
import { compressImageIfWithinLimit } from '@/lib/compress-image';

export type DocumentType = 'rc' | 'puc' | 'insurance' | 'warranty' | 'permits' | 'fitness';

export interface CarDocument {
  id: string;
  car_id: string;
  document_type: DocumentType;
  expiry_date: string | null;
  file_path: string | null;
  file_name: string | null;
  insurance_provider_name?: string | null;
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
  const { orgId } = useOrg();

  return useMutation({
    mutationFn: async ({
      carId,
      documentType,
      expiryDate,
      notes,
      file,
      insuranceProviderName,
    }: {
      carId: string;
      documentType: DocumentType;
      expiryDate?: string | null;
      notes?: string | null;
      file?: File;
      insuranceProviderName?: string | null;
    }) => {
      let file_path: string | null = null;
      let file_name: string | null = null;

      // Upload file if provided
      if (file) {
        const fileExt = file.name.split('.').pop() || 'bin';
        const key = carDocumentKey(carId, documentType, fileExt);
        const uploadFile = await compressImageIfWithinLimit(file, MAX_DOCUMENT_FILE_SIZE_BYTES);
        if (uploadFile.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
          throw new Error(`File must be 2 MB or smaller (${(file.size / 1024 / 1024).toFixed(2)} MB).`);
        }
        await storageUpload(key, uploadFile);
        file_path = key;
        file_name = file.name;
      }

      if (!orgId) throw new Error('Organization not found');
      const { data, error } = await supabase
        .from('car_documents')
        .upsert({
          organization_id: orgId,
          car_id: carId,
          document_type: documentType,
          expiry_date: expiryDate || null,
          file_path: file_path || undefined,
          file_name: file_name || undefined,
          insurance_provider_name: documentType === 'insurance' ? (insuranceProviderName || null) : null,
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
      const { data: doc } = await supabase.from('car_documents').select('file_path').eq('id', id).single();
      if (doc?.file_path) {
        const key = toFullKey('CAR_DOCUMENTS', doc.file_path);
        if (key) await storageRemove([key]);
      }
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
      const key = toFullKey('CAR_DOCUMENTS', filePath);
      if (!key) return null;
      return storageGetSignedUrl(key, 3600, undefined, 'car-documents');
    },
    enabled: !!filePath,
  });
}
