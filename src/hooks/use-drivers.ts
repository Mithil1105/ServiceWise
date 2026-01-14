import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Driver {
  id: string;
  name: string;
  phone: string;
  location: string | null;
  region: string | null;
  license_expiry: string | null;
  license_file_path: string | null;
  license_file_name: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Driver[];
    },
  });
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: ['drivers', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Driver;
    },
    enabled: !!id,
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (driver: {
      name: string;
      phone: string;
      location?: string;
      region?: string;
      license_expiry?: string;
      notes?: string;
      licenseFile?: File;
    }) => {
      let license_file_path: string | null = null;
      let license_file_name: string | null = null;

      // Upload license file if provided
      if (driver.licenseFile) {
        const fileExt = driver.licenseFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `licenses/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('driver-licenses')
          .upload(filePath, driver.licenseFile);

        if (uploadError) throw uploadError;

        license_file_path = filePath;
        license_file_name = driver.licenseFile.name;
      }

      const { data, error } = await supabase
        .from('drivers')
        .insert({
          name: driver.name,
          phone: driver.phone,
          location: driver.location || null,
          region: driver.region || null,
          license_expiry: driver.license_expiry || null,
          license_file_path,
          license_file_name,
          notes: driver.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Driver;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add driver', { description: error.message });
    },
  });
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      phone?: string;
      location?: string | null;
      region?: string | null;
      license_expiry?: string | null;
      license_file_path?: string | null;
      license_file_name?: string | null;
      status?: string;
      notes?: string | null;
      licenseFile?: File;
    }) => {
      let license_file_path = updates.license_file_path;
      let license_file_name = updates.license_file_name;

      // Upload new license file if provided
      if (updates.licenseFile) {
        const fileExt = updates.licenseFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `licenses/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('driver-licenses')
          .upload(filePath, updates.licenseFile);

        if (uploadError) throw uploadError;

        license_file_path = filePath;
        license_file_name = updates.licenseFile.name;
      }

      const { licenseFile, ...restUpdates } = updates;
      
      const { data, error } = await supabase
        .from('drivers')
        .update({
          ...restUpdates,
          license_file_path,
          license_file_name,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Driver;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['drivers', variables.id] });
      toast.success('Driver updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update driver', { description: error.message });
    },
  });
}

export function useDeleteDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('drivers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete driver', { description: error.message });
    },
  });
}

export function useDownloadLicense(filePath: string | null) {
  return useQuery({
    queryKey: ['driver-license', filePath],
    queryFn: async () => {
      if (!filePath) return null;
      
      const { data, error } = await supabase.storage
        .from('driver-licenses')
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!filePath,
  });
}
