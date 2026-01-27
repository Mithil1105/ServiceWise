import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Get all distinct brands from cars table
 */
export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cars')
        .select('brand')
        .not('brand', 'is', null);
      
      if (error) throw error;
      
      // Extract unique brands and sort
      const uniqueBrands = Array.from(
        new Set((data || []).map((item: { brand: string }) => item.brand).filter(Boolean))
      ).sort() as string[];
      
      return uniqueBrands;
    },
  });
}

/**
 * Search brands (for autocomplete)
 */
export function useSearchBrands(search: string) {
  return useQuery({
    queryKey: ['brands', 'search', search],
    queryFn: async () => {
      if (!search.trim()) return [];
      
      const { data, error } = await supabase
        .from('cars')
        .select('brand')
        .not('brand', 'is', null)
        .ilike('brand', `%${search}%`)
        .limit(20);
      
      if (error) throw error;
      
      // Extract unique brands
      const uniqueBrands = Array.from(
        new Set((data || []).map((item: { brand: string }) => item.brand).filter(Boolean))
      ).sort() as string[];
      
      return uniqueBrands;
    },
    enabled: search.length >= 1,
  });
}

/**
 * Create a new brand (by creating a dummy car entry with that brand)
 * This makes the brand available in the system
 */
export function useCreateBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (brandName: string) => {
      // Check if brand already exists
      const { data: existing } = await supabase
        .from('cars')
        .select('brand')
        .eq('brand', brandName.trim())
        .limit(1);

      if (existing && existing.length > 0) {
        throw new Error(`Brand "${brandName}" already exists`);
      }

      // Create a temporary car entry with this brand to make it available
      // We'll use a placeholder vehicle number that can be cleaned up later
      const tempVehicleNumber = `TEMP-BRAND-${Date.now()}`;
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('cars')
        .insert({
          vehicle_number: tempVehicleNumber,
          brand: brandName.trim(),
          model: 'Placeholder',
          status: 'inactive', // Mark as inactive so it doesn't show in fleet
          created_by: user?.id,
        });

      if (error) throw error;
      
      return brandName.trim();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Brand created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create brand: ${error.message}`);
    },
  });
}
