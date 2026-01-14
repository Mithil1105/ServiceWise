import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ServiceBillFile {
  id: string;
  service_record_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

export function useServiceBillFiles(serviceRecordId?: string) {
  return useQuery({
    queryKey: ['service-bill-files', serviceRecordId],
    queryFn: async () => {
      if (!serviceRecordId) return [];
      const { data, error } = await supabase
        .from('service_bill_files')
        .select('*')
        .eq('service_record_id', serviceRecordId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ServiceBillFile[];
    },
    enabled: !!serviceRecordId,
  });
}

export function useServiceBillsByRecordIds(recordIds: string[]) {
  return useQuery({
    queryKey: ['service-bill-files-batch', recordIds],
    queryFn: async () => {
      if (recordIds.length === 0) return {};
      const { data, error } = await supabase
        .from('service_bill_files')
        .select('*')
        .in('service_record_id', recordIds)
        .order('created_at', { ascending: true });
      if (error) throw error;
      
      // Group by service_record_id
      const grouped: Record<string, ServiceBillFile[]> = {};
      (data as ServiceBillFile[]).forEach((file) => {
        if (!grouped[file.service_record_id]) {
          grouped[file.service_record_id] = [];
        }
        grouped[file.service_record_id].push(file);
      });
      return grouped;
    },
    enabled: recordIds.length > 0,
  });
}

export function useUploadServiceBills() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      serviceRecordId,
      carId,
      files,
    }: {
      serviceRecordId: string;
      carId: string;
      files: File[];
    }) => {
      const uploadedFiles: Omit<ServiceBillFile, 'id' | 'created_at'>[] = [];

      for (const file of files) {
        const ext = file.name.split('.').pop();
        const fileName = `${carId}/${serviceRecordId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('service-bills')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        uploadedFiles.push({
          service_record_id: serviceRecordId,
          file_path: fileName,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
        });
      }

      // Insert records into database
      const { error: insertError } = await supabase
        .from('service_bill_files')
        .insert(uploadedFiles);

      if (insertError) throw insertError;

      return uploadedFiles;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['service-bill-files', variables.serviceRecordId] });
      queryClient.invalidateQueries({ queryKey: ['service-bill-files-batch'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteServiceBill() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bill: ServiceBillFile) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('service-bills')
        .remove([bill.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('service_bill_files')
        .delete()
        .eq('id', bill.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-bill-files'] });
      queryClient.invalidateQueries({ queryKey: ['service-bill-files-batch'] });
      toast({
        title: 'Bill deleted',
        description: 'The bill file has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
