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
  notes: string | null;
  status: string;
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
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Driver[];
    },
  });
}

export function useSearchDrivers(search: string) {
  return useQuery({
    queryKey: ['drivers', 'search', search],
    queryFn: async () => {
      if (!search.trim()) return [];

      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('status', 'active')
        .or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
        .limit(10);

      if (error) throw error;
      return data as Driver[];
    },
    enabled: search.length >= 2,
  });
}

export function useUpsertDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; phone: string }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      // Try to find existing driver by phone
      const { data: existing } = await supabase
        .from('drivers')
        .select('id, name')
        .eq('phone', data.phone.trim())
        .single();

      if (existing) {
        // Update name if different
        if (existing.name !== data.name.trim()) {
          const { error } = await supabase
            .from('drivers')
            .update({ name: data.name.trim() })
            .eq('id', existing.id);

          if (error) throw error;
        }
        return existing;
      }

      // Create new driver
      const { data: driver, error } = await supabase
        .from('drivers')
        .insert({
          name: data.name.trim(),
          phone: data.phone.trim(),
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return driver as Driver;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (error) => {
      toast.error(`Failed to save driver: ${error.message}`);
    },
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      phone: string;
      location?: string;
      region?: string;
      license_expiry?: string;
      notes?: string;
      licenseFile?: File;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      let license_file_path: string | null = null;
      let license_file_name: string | null = null;

      // Upload license file if provided
      if (data.licenseFile) {
        const fileExt = data.licenseFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('driver-licenses')
          .upload(fileName, data.licenseFile);

        if (uploadError) throw uploadError;

        license_file_path = fileName;
        license_file_name = data.licenseFile.name;
      }

      const { data: driver, error } = await supabase
        .from('drivers')
        .insert({
          name: data.name.trim(),
          phone: data.phone.trim(),
          location: data.location?.trim() || null,
          region: data.region?.trim() || null,
          license_expiry: data.license_expiry || null,
          notes: data.notes?.trim() || null,
          license_file_path,
          license_file_name,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return driver as Driver;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create driver: ${error.message}`);
    },
  });
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      phone?: string;
      location?: string;
      region?: string;
      license_expiry?: string;
      notes?: string;
      licenseFile?: File;
    }) => {
      let license_file_path: string | null | undefined = undefined;
      let license_file_name: string | null | undefined = undefined;

      // Upload license file if provided
      if (data.licenseFile) {
        // Get existing driver to delete old file if exists
        const { data: existingDriver } = await supabase
          .from('drivers')
          .select('license_file_path')
          .eq('id', data.id)
          .single();

        // Delete old file if exists
        if (existingDriver?.license_file_path) {
          await supabase.storage
            .from('driver-licenses')
            .remove([existingDriver.license_file_path]);
        }

        const fileExt = data.licenseFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('driver-licenses')
          .upload(fileName, data.licenseFile);

        if (uploadError) throw uploadError;

        license_file_path = fileName;
        license_file_name = data.licenseFile.name;
      }

      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.phone !== undefined) updateData.phone = data.phone.trim();
      if (data.location !== undefined) updateData.location = data.location?.trim() || null;
      if (data.region !== undefined) updateData.region = data.region?.trim() || null;
      if (data.license_expiry !== undefined) updateData.license_expiry = data.license_expiry || null;
      if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
      if (license_file_path !== undefined) updateData.license_file_path = license_file_path;
      if (license_file_name !== undefined) updateData.license_file_name = license_file_name;

      const { data: driver, error } = await supabase
        .from('drivers')
        .update(updateData)
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return driver as Driver;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update driver: ${error.message}`);
    },
  });
}

export function useDeleteDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get driver to delete license file if exists
      const { data: driver } = await supabase
        .from('drivers')
        .select('license_file_path')
        .eq('id', id)
        .single();

      // Delete license file if exists
      if (driver?.license_file_path) {
        await supabase.storage
          .from('driver-licenses')
          .remove([driver.license_file_path]);
      }

      // Delete driver record
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete driver: ${error.message}`);
    },
  });
}

export function useDownloadLicense(filePath: string | null) {
  return useQuery({
    queryKey: ['driver-license-url', filePath],
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
