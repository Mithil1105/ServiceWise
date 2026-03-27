import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FuelEntry, FuelEntryBill } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { storageUpload } from '@/lib/storage';
import { fuelBillKey } from '@/lib/storage-keys';
import { compressImageIfWithinLimit } from '@/lib/compress-image';
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from '@/lib/document-upload';

type FuelEntriesFilters = {
  carId?: string;
  from?: string; // ISO
  to?: string; // ISO
};

function normalizeFuelEntry(e: any): FuelEntry {
  return {
    ...e,
    odometer_km: Number(e.odometer_km),
    fuel_liters: Number(e.fuel_liters),
    amount_inr: Number(e.amount_inr),
  } as FuelEntry;
}

export function useFuelEntries(filters: FuelEntriesFilters = {}) {
  const { carId, from, to } = filters;

  return useQuery({
    queryKey: ['fuel-entries', carId ?? 'all', from ?? 'all', to ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('fuel_entries')
        .select('*')
        .order('filled_at', { ascending: false });

      if (carId) q = q.eq('car_id', carId);
      if (from) q = q.gte('filled_at', from);
      if (to) q = q.lte('filled_at', to);

      const { data, error } = await q;
      if (error) throw error;

      return (data ?? []).map(normalizeFuelEntry);
    },
    enabled: true,
  });
}

export function useLatestFuelEntry(carId: string | undefined) {
  return useQuery({
    queryKey: ['latest-fuel-entry', carId ?? 'none'],
    queryFn: async () => {
      if (!carId) return null;
      const { data, error } = await supabase
        .from('fuel_entries')
        .select('*')
        .eq('car_id', carId)
        .order('filled_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ? normalizeFuelEntry(data) : null;
    },
    enabled: !!carId,
  });
}

export function useCreateFuelEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      car_id: string;
      filled_at: string; // ISO
      odometer_km: number;
      fuel_liters: number;
      amount_inr: number;
      fuel_type: string;
      is_full_tank: boolean;
      notes?: string;
      billFile?: File | null;
      entered_by_override?: string; // optional for tests/edge flows
    }) => {
      const orgId = profile?.organization_id;
      if (!orgId) throw new Error('Organization not found');

      const { data: userData } = await supabase.auth.getUser();
      const userId = payload.entered_by_override ?? userData.user?.id;
      if (!userId) throw new Error('User not found');

      // 1) Insert fuel entry
      const { data: fuelEntry, error: fuelErr } = await supabase
        .from('fuel_entries')
        .insert({
          organization_id: orgId,
          car_id: payload.car_id,
          filled_at: payload.filled_at,
          odometer_km: payload.odometer_km,
          fuel_liters: payload.fuel_liters,
          amount_inr: payload.amount_inr,
          fuel_type: payload.fuel_type,
          is_full_tank: payload.is_full_tank,
          notes: payload.notes ?? null,
          entered_by: userId,
        })
        .select('*')
        .single();

      if (fuelErr) throw fuelErr;
      if (!fuelEntry) throw new Error('Fuel entry insertion failed');

      // 2) Mirror odometer entry for timeline consistency
      const { error: odoErr } = await supabase.from('odometer_entries').insert({
        organization_id: orgId,
        car_id: payload.car_id,
        odometer_km: payload.odometer_km,
        reading_at: payload.filled_at,
        entered_by: userId,
      });

      if (odoErr) throw odoErr;

      // 3) Optional bill upload + database record (best-effort)
      if (payload.billFile) {
        try {
          const billFile = payload.billFile;
          const key = fuelBillKey(fuelEntry.id, billFile.name);

          const uploadFile =
            billFile.type.startsWith('image/')
              ? await compressImageIfWithinLimit(billFile, MAX_DOCUMENT_FILE_SIZE_BYTES)
              : billFile;

          if (uploadFile.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
            throw new Error(
              `Bill must be 2 MB or smaller (${(uploadFile.size / 1024 / 1024).toFixed(2)} MB).`
            );
          }

          const res = await storageUpload(key, uploadFile);

          const { error: billInsertErr } = await supabase
            .from('fuel_entry_bills' as any)
            .insert({
              organization_id: orgId,
              fuel_entry_id: fuelEntry.id,
              file_path: res.key,
              file_name: billFile.name || 'fuel-bill',
              file_size: uploadFile.size,
              file_type: billFile.type || 'application/octet-stream',
            });

          if (billInsertErr) throw billInsertErr;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          toast({
            title: 'Fuel entry saved (bill upload failed)',
            description: message,
            variant: 'destructive',
          });
        }
      }

      return normalizeFuelEntry(fuelEntry);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fuel-entries'] });
      queryClient.invalidateQueries({ queryKey: ['latest-fuel-entry', variables.car_id] });
      queryClient.invalidateQueries({ queryKey: ['odometer-entries', variables.car_id] });
      queryClient.invalidateQueries({ queryKey: ['latest-odometer', variables.car_id] });
      queryClient.invalidateQueries({ queryKey: ['fuel-entry-bills-batch'] });
      toast({ title: 'Fuel entry saved', description: 'Fuel fill and odometer entry were recorded.' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save fuel entry',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useFuelEntryBillsByFuelEntryIds(fuelEntryIds: string[]) {
  return useQuery({
    queryKey: ['fuel-entry-bills-batch', fuelEntryIds],
    queryFn: async () => {
      if (fuelEntryIds.length === 0) return {} as Record<string, FuelEntryBill[]>;

      const { data, error } = await supabase
        .from('fuel_entry_bills' as any)
        .select('*')
        .in('fuel_entry_id', fuelEntryIds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const grouped: Record<string, FuelEntryBill[]> = {};
      (data as FuelEntryBill[]).forEach((bill) => {
        if (!grouped[bill.fuel_entry_id]) grouped[bill.fuel_entry_id] = [];
        grouped[bill.fuel_entry_id].push(bill);
      });
      return grouped;
    },
    enabled: fuelEntryIds.length > 0,
  });
}

