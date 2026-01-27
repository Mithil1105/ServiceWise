import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Car, CarWithStatus, OdometerEntry, CarServiceRule, ServiceRule } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useCars() {
  return useQuery({
    queryKey: ['cars'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Car[];
    },
  });
}

export function useCarsWithStatus() {
  return useQuery({
    queryKey: ['cars-with-status'],
    queryFn: async () => {
      // Fetch cars
      const { data: cars, error: carsError } = await supabase
        .from('cars')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (carsError) throw carsError;

      // Fetch latest odometer for each car
      const { data: odometers, error: odoError } = await supabase
        .from('odometer_entries')
        .select('*')
        .order('reading_at', { ascending: false });
      
      if (odoError) throw odoError;

      // Fetch car service rules with service rules
      const { data: carServiceRules, error: csrError } = await supabase
        .from('car_service_rules')
        .select('*, service_rules(*)');
      
      if (csrError) throw csrError;

      // Build cars with status
      const carsWithStatus: CarWithStatus[] = (cars as Car[]).map((car) => {
        const carOdometers = (odometers as OdometerEntry[]).filter(o => o.car_id === car.id);
        const latestOdo = carOdometers[0];
        const currentKm = latestOdo?.odometer_km || 0;

        const carRules = (carServiceRules as any[]).filter(
          csr => csr.car_id === car.id && csr.enabled && csr.service_rules?.is_critical
        );

        let nextCriticalStatus: 'ok' | 'due-soon' | 'overdue' = 'ok';
        let nextCriticalInfo: CarWithStatus['next_critical_info'] = undefined;
        let worstRemaining = Infinity;

        for (const csr of carRules) {
          const rule = csr.service_rules as ServiceRule;
          if (!rule.interval_km) continue;

          const lastServicedKm = csr.last_serviced_km || 0;
          const dueKm = lastServicedKm + rule.interval_km;
          const remainingKm = dueKm - currentKm;
          const threshold = rule.due_soon_threshold_km || 500;

          if (remainingKm < worstRemaining) {
            worstRemaining = remainingKm;
            
            if (remainingKm < 0) {
              nextCriticalStatus = 'overdue';
            } else if (remainingKm <= threshold && nextCriticalStatus !== 'overdue') {
              nextCriticalStatus = 'due-soon';
            }

            if (remainingKm <= threshold || remainingKm < 0) {
              nextCriticalInfo = {
                service_name: rule.name,
                due_km: dueKm,
                remaining_km: remainingKm,
              };
            }
          }
        }

        return {
          ...car,
          current_km: currentKm,
          next_critical_status: nextCriticalStatus,
          next_critical_info: nextCriticalInfo,
        };
      });

      return carsWithStatus;
    },
  });
}

export function useCar(id: string) {
  return useQuery({
    queryKey: ['car', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Car;
    },
    enabled: !!id,
  });
}

export function useCreateCar() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (carData: Partial<Car> & { initial_odometer: number; seats?: number }) => {
      const { initial_odometer, seats, ...carFields } = carData;
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create car
      const { data: car, error: carError } = await supabase
        .from('cars')
        .insert({
          vehicle_number: carFields.vehicle_number!,
          brand: carFields.brand,
          model: carFields.model!,
          year: carFields.year,
          fuel_type: carFields.fuel_type,
          vehicle_type: carFields.vehicle_type,
          owner_name: carFields.owner_name,
          status: carFields.status || 'active',
          vin_chassis: carFields.vin_chassis,
          notes: carFields.notes,
          seats: seats ?? 5,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (carError) throw carError;

      // Create initial odometer entry
      const { error: odoError } = await supabase
        .from('odometer_entries')
        .insert({
          car_id: car.id,
          odometer_km: initial_odometer,
          entered_by: user?.id,
        });
      
      if (odoError) throw odoError;

      // Get brand-specific service rules (if brand is provided)
      if (carFields.brand) {
        const { data: brandRules } = await supabase
          .from('service_rules')
          .select('id')
          .eq('brand', carFields.brand)
          .eq('active', true);

        if (brandRules && brandRules.length > 0) {
          // Attach all brand-specific service rules to the car
          const carServiceRules = brandRules.map(rule => ({
            car_id: car.id,
            rule_id: rule.id,
            last_serviced_km: initial_odometer,
            last_serviced_at: new Date().toISOString().split('T')[0],
          }));

          await supabase
            .from('car_service_rules')
            .insert(carServiceRules);
        }
      } else {
        // Fallback: Get default service rule (General Service) if no brand rules found
        const { data: defaultRule } = await supabase
          .from('service_rules')
          .select('id')
          .eq('name', 'General Service')
          .eq('active', true)
          .single();

        if (defaultRule) {
          // Attach default service rule
          await supabase
            .from('car_service_rules')
            .insert({
              car_id: car.id,
              rule_id: defaultRule.id,
              last_serviced_km: initial_odometer,
              last_serviced_at: new Date().toISOString().split('T')[0],
            });
        }
      }

      return car as Car;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      queryClient.invalidateQueries({ queryKey: ['cars-with-status'] });
      toast({
        title: 'Car added',
        description: 'Vehicle has been added to the fleet.',
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

export function useUpdateCar() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Car> & { id: string }) => {
      const { data, error } = await supabase
        .from('cars')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Car;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      queryClient.invalidateQueries({ queryKey: ['cars-with-status'] });
      queryClient.invalidateQueries({ queryKey: ['car', variables.id] });
      toast({
        title: 'Car updated',
        description: 'Vehicle information has been updated.',
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
