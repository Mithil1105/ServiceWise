import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ServiceRule, ServiceRecord, CarServiceRule, CriticalServiceItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { isoAtNoonUtcFromDateInput } from '@/lib/date';

/**
 * Search existing rule names (for autocomplete)
 */
export function useSearchRuleNames(search: string) {
  return useQuery({
    queryKey: ['rule-names', 'search', search],
    queryFn: async () => {
      if (!search.trim()) return [];
      
      const { data, error } = await supabase
        .from('service_rules')
        .select('name')
        .ilike('name', `%${search}%`)
        .limit(20);
      
      if (error) throw error;
      
      // Extract unique rule names and sort
      const uniqueNames = Array.from(
        new Set((data || []).map((rule: { name: string }) => rule.name).filter(Boolean))
      ).sort() as string[];
      
      return uniqueNames;
    },
    enabled: search.length >= 2,
  });
}

export function useServiceRules(brand?: string | null) {
  return useQuery({
    queryKey: ['service-rules', brand],
    queryFn: async () => {
      let query = supabase
        .from('service_rules')
        .select('*')
        .eq('active', true);
      
      if (brand) {
        query = query.eq('brand', brand);
      } else {
        // If no brand specified, only get brand-specific rules (exclude NULL/global template rules)
        query = query.not('brand', 'is', null);
      }
      
      const { data, error } = await query.order('name', { ascending: true });
      
      if (error) throw error;
      return (data || []) as ServiceRule[];
    },
  });
}

/**
 * Get all brands that have service rules
 */
export function useBrandsWithRules() {
  return useQuery({
    queryKey: ['brands-with-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_rules')
        .select('brand')
        .not('brand', 'is', null)
        .eq('active', true);
      
      if (error) throw error;
      
      // Extract unique brands and sort
      const uniqueBrands = Array.from(
        new Set((data || []).map((rule: { brand: string }) => rule.brand).filter(Boolean))
      ).sort() as string[];
      
      return uniqueBrands || [];
    },
  });
}

export function useServiceRecords(carId?: string) {
  return useQuery({
    queryKey: ['service-records', carId],
    queryFn: async () => {
      let query = supabase
        .from('service_records')
        .select('*')
        .order('serviced_at', { ascending: false });
      
      if (carId) {
        query = query.eq('car_id', carId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ServiceRecord[];
    },
  });
}

export function useCreateServiceRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (record: {
      car_id: string;
      rule_id?: string;
      service_name: string;
      serviced_at: string;
      odometer_km: number;
      vendor_name?: string;
      vendor_location?: string;
      cost?: number;
      notes?: string;
      bill_path?: string;
      warranty_expiry?: string;
      serial_number?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create service record
      const { data, error } = await supabase
        .from('service_records')
        .insert({
          ...record,
          entered_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;

      // If this service happened after the latest odometer reading, also record it as an odometer entry
      // so "current km" calculations stay accurate.
      const { data: lastOdo, error: lastOdoError } = await supabase
        .from('odometer_entries')
        .select('odometer_km, reading_at')
        .eq('car_id', record.car_id)
        .order('reading_at', { ascending: false })
        .limit(1)
        .single();

      const hasNoOdo = lastOdoError && lastOdoError.code === 'PGRST116';
      const serviceReadingAt = isoAtNoonUtcFromDateInput(record.serviced_at);

      const shouldCreateOdoEntry =
        hasNoOdo ||
        (!lastOdoError &&
          lastOdo &&
          new Date(serviceReadingAt).getTime() > new Date(lastOdo.reading_at).getTime() &&
          record.odometer_km >= lastOdo.odometer_km);

      if (shouldCreateOdoEntry) {
        const { error: odoInsertError } = await supabase
          .from('odometer_entries')
          .insert({
            car_id: record.car_id,
            odometer_km: record.odometer_km,
            reading_at: serviceReadingAt,
            entered_by: user?.id,
          });

        if (odoInsertError) throw odoInsertError;
      }

      // Update car_service_rules if rule_id is provided
      if (record.rule_id) {
        await supabase
          .from('car_service_rules')
          .update({
            last_serviced_km: record.odometer_km,
            last_serviced_at: record.serviced_at,
          })
          .eq('car_id', record.car_id)
          .eq('rule_id', record.rule_id);
      }

      // Log supervisor activity if user is supervisor
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .single();

      if (userRole?.role === 'supervisor') {
        await supabase.from('supervisor_activity_log').insert({
          supervisor_id: user?.id,
          car_id: record.car_id,
          action_type: 'service_added',
          action_details: {
            service_name: record.service_name,
            odometer_km: record.odometer_km,
            cost: record.cost,
            vendor_name: record.vendor_name,
          },
        });
      }

      return data as ServiceRecord;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['service-records'] });
      queryClient.invalidateQueries({ queryKey: ['odometer-entries'] });
      queryClient.invalidateQueries({ queryKey: ['latest-odometer', variables.car_id] });
      queryClient.invalidateQueries({ queryKey: ['cars-with-status'] });
      queryClient.invalidateQueries({ queryKey: ['critical-services'] });
      queryClient.invalidateQueries({ queryKey: ['supervisor-activity'] });
      toast({
        title: 'Service recorded',
        description: 'Service record has been added.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useCriticalServices() {
  return useQuery({
    queryKey: ['critical-services'],
    queryFn: async () => {
      // Fetch cars
      const { data: cars, error: carsError } = await supabase
        .from('cars')
        .select('*')
        .eq('status', 'active');
      
      if (carsError) throw carsError;

      // Fetch latest odometer for each car
      const { data: odometers, error: odoError } = await supabase
        .from('odometer_entries')
        .select('*')
        .order('reading_at', { ascending: false });
      
      if (odoError) throw odoError;

      // Fetch car service rules with critical rules
      const { data: carServiceRules, error: csrError } = await supabase
        .from('car_service_rules')
        .select('*, service_rules(*)')
        .eq('enabled', true);
      
      if (csrError) throw csrError;

      const criticalItems: CriticalServiceItem[] = [];

      for (const car of cars || []) {
        const carOdometers = (odometers || []).filter((o: any) => o.car_id === car.id);
        const latestOdo = carOdometers[0];
        const currentKm = latestOdo?.odometer_km || 0;

        const carRules = (carServiceRules || []).filter(
          (csr: any) => csr.car_id === car.id && csr.service_rules?.is_critical
        );

        for (const csr of carRules) {
          const rule = csr.service_rules;
          if (!rule?.interval_km) continue;

          const lastServicedKm = csr.last_serviced_km || 0;
          const dueKm = lastServicedKm + rule.interval_km;
          const remainingKm = dueKm - currentKm;
          const threshold = rule.due_soon_threshold_km || 500;

          if (remainingKm <= threshold) {
            criticalItems.push({
              car_id: car.id,
              vehicle_number: car.vehicle_number,
              service_name: rule.name,
              current_km: currentKm,
              due_km: dueKm,
              remaining_km: remainingKm,
              last_serviced_km: csr.last_serviced_km,
              last_serviced_at: csr.last_serviced_at,
              status: remainingKm < 0 ? 'overdue' : 'due-soon',
            });
          }
        }
      }

      // Sort: overdue first, then by remaining km
      criticalItems.sort((a, b) => {
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (a.status !== 'overdue' && b.status === 'overdue') return 1;
        return a.remaining_km - b.remaining_km;
      });

      return criticalItems;
    },
  });
}

export function useCreateServiceRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rule: Omit<Partial<ServiceRule>, 'id' | 'created_at' | 'updated_at'> & { name: string; brand: string }) => {
      const { data, error } = await supabase
        .from('service_rules')
        .insert({
          name: rule.name,
          brand: rule.brand,
          interval_km: rule.interval_km,
          interval_days: rule.interval_days,
          is_critical: rule.is_critical ?? false,
          due_soon_threshold_km: rule.due_soon_threshold_km ?? 500,
          due_soon_threshold_days: rule.due_soon_threshold_days ?? 7,
          active: rule.active ?? true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as ServiceRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-rules'] });
      queryClient.invalidateQueries({ queryKey: ['brands-with-rules'] });
      toast({
        title: 'Service rule created',
        description: 'New service rule has been added.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Copy service rules from one brand to another
 */
export function useCopyServiceRules() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ fromBrand, toBrand }: { fromBrand: string; toBrand: string }) => {
      // Get all rules from source brand
      const { data: sourceRules, error: fetchError } = await supabase
        .from('service_rules')
        .select('*')
        .eq('brand', fromBrand)
        .eq('active', true);
      
      if (fetchError) throw fetchError;
      if (!sourceRules || sourceRules.length === 0) {
        throw new Error(`No active rules found for brand "${fromBrand}"`);
      }

      // Check if target brand already has rules
      const { data: existingRules } = await supabase
        .from('service_rules')
        .select('id')
        .eq('brand', toBrand)
        .limit(1);
      
      if (existingRules && existingRules.length > 0) {
        throw new Error(`Brand "${toBrand}" already has service rules. Please delete them first or use a different brand.`);
      }

      // Insert rules for target brand
      const rulesToInsert = sourceRules.map(rule => ({
        name: rule.name,
        brand: toBrand,
        interval_km: rule.interval_km,
        interval_days: rule.interval_days,
        is_critical: rule.is_critical,
        due_soon_threshold_km: rule.due_soon_threshold_km,
        due_soon_threshold_days: rule.due_soon_threshold_days,
        active: true,
      }));

      const { error: insertError } = await supabase
        .from('service_rules')
        .insert(rulesToInsert);
      
      if (insertError) throw insertError;
      
      return { copiedCount: sourceRules.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['service-rules'] });
      queryClient.invalidateQueries({ queryKey: ['brands-with-rules'] });
      toast({
        title: 'Rules copied',
        description: `Successfully copied ${data.copiedCount} service rules.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Apply service rules to multiple brands
 */
export function useApplyRulesToBrands() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ fromBrand, toBrands }: { fromBrand: string; toBrands: string[] }) => {
      // Get all rules from source brand
      const { data: sourceRules, error: fetchError } = await supabase
        .from('service_rules')
        .select('*')
        .eq('brand', fromBrand)
        .eq('active', true);
      
      if (fetchError) throw fetchError;
      if (!sourceRules || sourceRules.length === 0) {
        throw new Error(`No active rules found for brand "${fromBrand}"`);
      }

      const results: { brand: string; success: boolean; error?: string }[] = [];

      for (const toBrand of toBrands) {
        // Check if target brand already has rules
        const { data: existingRules } = await supabase
          .from('service_rules')
          .select('id')
          .eq('brand', toBrand)
          .limit(1);
        
        if (existingRules && existingRules.length > 0) {
          results.push({ brand: toBrand, success: false, error: 'Already has rules' });
          continue;
        }

        // Insert rules for target brand
        const rulesToInsert = sourceRules.map(rule => ({
          name: rule.name,
          brand: toBrand,
          interval_km: rule.interval_km,
          interval_days: rule.interval_days,
          is_critical: rule.is_critical,
          due_soon_threshold_km: rule.due_soon_threshold_km,
          due_soon_threshold_days: rule.due_soon_threshold_days,
          active: true,
        }));

        const { error: insertError } = await supabase
          .from('service_rules')
          .insert(rulesToInsert);
        
        if (insertError) {
          results.push({ brand: toBrand, success: false, error: insertError.message });
        } else {
          results.push({ brand: toBrand, success: true });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return { results, successCount, failCount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['service-rules'] });
      queryClient.invalidateQueries({ queryKey: ['brands-with-rules'] });
      
      if (data.failCount === 0) {
        toast({
          title: 'Rules applied',
          description: `Successfully applied rules to ${data.successCount} brand(s).`,
        });
      } else {
        toast({
          title: 'Partial success',
          description: `Applied to ${data.successCount} brand(s), ${data.failCount} failed.`,
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

