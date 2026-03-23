import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from '@/lib/document-upload';
import { storageUpload, storageRemove, storageGetSignedUrl } from '@/lib/storage';
import { driverLicenseKey, toFullKey } from '@/lib/storage-keys';

export type DriverType = 'permanent' | 'temporary';

export interface Driver {
  id: string;
  name: string;
  phone: string;
  location: string | null;
  region: string | null;
  license_type: 'lmv' | 'hmv';
  license_expiry: string | null;
  license_file_path: string | null;
  license_file_name: string | null;
  /** Permanent or temporary driver */
  driver_type: DriverType;
  /** Aadhaar card document (driver-licenses bucket) */
  aadhaar_file_path?: string | null;
  aadhaar_file_name?: string | null;
  police_verification_file_path?: string | null;
  police_verification_file_name?: string | null;
  health_certificate_file_path?: string | null;
  health_certificate_file_name?: string | null;
  notes: string | null;
  status: string;
  /** Org-defined custom field values (from drivers_form_config.customFields) */
  custom_attributes?: Record<string, string | number | boolean | null>;
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
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: { name: string; phone: string }) => {
      const orgId = profile?.organization_id;
      if (!orgId) throw new Error('Organization not found');
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { data: existing } = await supabase
        .from('drivers')
        .select('id, name')
        .eq('organization_id', orgId)
        .eq('phone', data.phone.trim())
        .single();

      if (existing) {
        if (existing.name !== data.name.trim()) {
          const { error } = await supabase
            .from('drivers')
            .update({ name: data.name.trim() })
            .eq('id', existing.id);

          if (error) throw error;
        }
        return existing;
      }

      const { data: driver, error } = await supabase
        .from('drivers')
        .insert({
          organization_id: orgId,
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

const uploadDriverFile = async (file: File, prefix: string): Promise<{ path: string; name: string }> => {
  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new Error(`File must be 2 MB or smaller (${(file.size / 1024 / 1024).toFixed(2)} MB).`);
  }
  const fileExt = file.name.split('.').pop() || 'bin';
  const key = driverLicenseKey(prefix, fileExt);
  await storageUpload(key, file);
  return { path: key, name: file.name };
};

export function useCreateDriver() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      phone: string;
      location?: string;
      region?: string;
      license_type: 'lmv' | 'hmv';
      license_expiry?: string;
      notes?: string;
      licenseFile?: File;
      driver_type?: DriverType;
      aadhaarFile?: File;
      policeVerificationFile?: File;
      healthCertificateFile?: File;
      custom_attributes?: Record<string, string | number | boolean | null>;
    }) => {
      const orgId = profile?.organization_id;
      if (!orgId) throw new Error('Organization not found');
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      let license_file_path: string | null = null;
      let license_file_name: string | null = null;
      if (data.licenseFile) {
        const up = await uploadDriverFile(data.licenseFile, 'license');
        license_file_path = up.path;
        license_file_name = up.name;
      }

      let aadhaar_file_path: string | null = null;
      let aadhaar_file_name: string | null = null;
      if (data.aadhaarFile) {
        const up = await uploadDriverFile(data.aadhaarFile, 'aadhaar');
        aadhaar_file_path = up.path;
        aadhaar_file_name = up.name;
      }
      let police_verification_file_path: string | null = null;
      let police_verification_file_name: string | null = null;
      if (data.policeVerificationFile) {
        const up = await uploadDriverFile(data.policeVerificationFile, 'police');
        police_verification_file_path = up.path;
        police_verification_file_name = up.name;
      }
      let health_certificate_file_path: string | null = null;
      let health_certificate_file_name: string | null = null;
      if (data.healthCertificateFile) {
        const up = await uploadDriverFile(data.healthCertificateFile, 'health');
        health_certificate_file_path = up.path;
        health_certificate_file_name = up.name;
      }

      const { data: driver, error } = await supabase
        .from('drivers')
        .insert({
          organization_id: orgId,
          name: data.name.trim(),
          phone: data.phone.trim(),
          location: data.location?.trim() || null,
          region: data.region?.trim() || null,
          license_type: data.license_type || 'lmv',
          license_expiry: data.license_expiry || null,
          notes: data.notes?.trim() || null,
          license_file_path,
          license_file_name,
          driver_type: data.driver_type ?? 'temporary',
          aadhaar_file_path,
          aadhaar_file_name,
          police_verification_file_path,
          police_verification_file_name,
          health_certificate_file_path,
          health_certificate_file_name,
          custom_attributes: data.custom_attributes ?? null,
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
      license_type?: 'lmv' | 'hmv';
      license_expiry?: string;
      notes?: string;
      licenseFile?: File;
      driver_type?: DriverType;
      aadhaarFile?: File;
      policeVerificationFile?: File;
      healthCertificateFile?: File;
      custom_attributes?: Record<string, string | number | boolean | null>;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.phone !== undefined) updateData.phone = data.phone.trim();
      if (data.location !== undefined) updateData.location = data.location?.trim() || null;
      if (data.region !== undefined) updateData.region = data.region?.trim() || null;
      if (data.license_type !== undefined) updateData.license_type = data.license_type;
      if (data.license_expiry !== undefined) updateData.license_expiry = data.license_expiry || null;
      if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
      if (data.driver_type !== undefined) updateData.driver_type = data.driver_type;
      if (data.custom_attributes !== undefined) updateData.custom_attributes = data.custom_attributes;

      const { data: existingDriver } = await supabase
        .from('drivers')
        .select('license_file_path, aadhaar_file_path, police_verification_file_path, health_certificate_file_path')
        .eq('id', data.id)
        .single();

      if (data.licenseFile) {
        if (existingDriver?.license_file_path) {
          const key = toFullKey('DRIVER_LICENSES', existingDriver.license_file_path);
          if (key) await storageRemove([key]);
        }
        const up = await uploadDriverFile(data.licenseFile, 'license');
        updateData.license_file_path = up.path;
        updateData.license_file_name = up.name;
      }
      if (data.aadhaarFile) {
        if (existingDriver?.aadhaar_file_path) {
          const key = toFullKey('DRIVER_LICENSES', existingDriver.aadhaar_file_path);
          if (key) await storageRemove([key]);
        }
        const up = await uploadDriverFile(data.aadhaarFile, 'aadhaar');
        updateData.aadhaar_file_path = up.path;
        updateData.aadhaar_file_name = up.name;
      }
      if (data.policeVerificationFile) {
        if (existingDriver?.police_verification_file_path) {
          const key = toFullKey('DRIVER_LICENSES', existingDriver.police_verification_file_path);
          if (key) await storageRemove([key]);
        }
        const up = await uploadDriverFile(data.policeVerificationFile, 'police');
        updateData.police_verification_file_path = up.path;
        updateData.police_verification_file_name = up.name;
      }
      if (data.healthCertificateFile) {
        if (existingDriver?.health_certificate_file_path) {
          const key = toFullKey('DRIVER_LICENSES', existingDriver.health_certificate_file_path);
          if (key) await storageRemove([key]);
        }
        const up = await uploadDriverFile(data.healthCertificateFile, 'health');
        updateData.health_certificate_file_path = up.path;
        updateData.health_certificate_file_name = up.name;
      }

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
      const { data: driver } = await supabase
        .from('drivers')
        .select('license_file_path, aadhaar_file_path, police_verification_file_path, health_certificate_file_path')
        .eq('id', id)
        .single();

      const paths = [
        driver?.license_file_path,
        driver?.aadhaar_file_path,
        driver?.police_verification_file_path,
        driver?.health_certificate_file_path,
      ].filter(Boolean) as string[];
      if (paths.length > 0) {
        const keys = paths.map((p) => toFullKey('DRIVER_LICENSES', p)).filter(Boolean) as string[];
        if (keys.length) await storageRemove(keys);
      }

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
      const key = toFullKey('DRIVER_LICENSES', filePath);
      if (!key) return null;
      return storageGetSignedUrl(key, 3600, undefined, 'driver-licenses');
    },
    enabled: !!filePath,
  });
}
